import * as PIXI from 'pixi.js'
import type { Project, Layer, Asset, ShapeData, ShapeSegment } from '../types/project'
import { DEFAULT_LAYER_PROPS } from '../types/project'
import type { InterpolatedProps } from './interpolation'
import { getInterpolatedProps } from './interpolation'
import { useEditorStore } from '../store/editorStore'
import { TransformHandles } from './TransformHandles'
import type { DragMode } from './TransformHandles'

type SelectionCallback = (layerId: string | null, shiftKey?: boolean) => void
type TransformCallback = (layerId: string, props: Partial<InterpolatedProps>) => void
type TransformEndCallback = (
  layerId: string,
  before: Partial<InterpolatedProps>,
  after: Partial<InterpolatedProps>
) => void
type ContextMenuCallback = (layerId: string | null, screenX: number, screenY: number) => void

export class StageRenderer {
  app!: PIXI.Application
  private initialized = false
  private worldContainer!: PIXI.Container
  private selectionOverlay!: PIXI.Graphics
  private stageBg!: PIXI.Graphics
  private lastBgKey = ''

  // Caches
  private spriteCache = new Map<string, PIXI.Sprite>()
  private textCache = new Map<string, PIXI.Text>()
  private shapeCache = new Map<string, PIXI.Graphics>()
  private textureCache = new Map<string, PIXI.Texture>()
  private layerContainers = new Map<string, PIXI.Container>()

  // Callbacks
  private onSelect: SelectionCallback | null = null
  private onTransform: TransformCallback | null = null
  private onTransformEnd: TransformEndCallback | null = null
  private onContextMenu: ContextMenuCallback | null = null

  // Transform handles
  private transformHandles!: TransformHandles

  // Hover state
  private hoveredLayerId: string | null = null

  // Drag state
  private dragLayerId: string | null = null
  private dragStartPointer = { x: 0, y: 0 }
  private dragStartProps = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
  private isDragging = false
  private dragMode: DragMode = 'none'
  private currentZoom = 1

  // Marquee selection state
  private isMarqueeSelecting = false
  private marqueeStart = { x: 0, y: 0 }
  private marqueeEnd = { x: 0, y: 0 }
  private marqueeGraphics!: PIXI.Graphics

  // Current state
  private currentProject: Project | null = null
  private currentFrame = 0
  private selectedLayerIds: string[] = []
  private dirty = true

  async init(
    container: HTMLDivElement,
    width: number,
    height: number,
    backgroundColor: string
  ): Promise<void> {
    this.app = new PIXI.Application()
    await this.app.init({
      width,
      height,
      backgroundColor: backgroundColor || '#000000',
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    })

    // PixiJS creates its own canvas — append it to the container div
    container.appendChild(this.app.canvas)
    this.app.canvas.style.width = '100%'
    this.app.canvas.style.height = '100%'
    this.app.canvas.style.display = 'block'

    this.worldContainer = new PIXI.Container()
    this.selectionOverlay = new PIXI.Graphics()
    this.stageBg = new PIXI.Graphics()
    this.worldContainer.addChildAt(this.stageBg, 0)
    this.app.stage.addChild(this.worldContainer)
    this.app.stage.addChild(this.selectionOverlay)
    this.transformHandles = new TransformHandles(this.selectionOverlay)
    this.marqueeGraphics = new PIXI.Graphics()
    this.app.stage.addChild(this.marqueeGraphics)

    this.app.stage.eventMode = 'static'
    this.app.stage.hitArea = this.app.screen

    // Prevent browser context menu on canvas
    this.app.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Click on empty stage: check handles first, then deselect
    this.app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      // Right-click → context menu
      if (e.button === 2) {
        this.onContextMenu?.(null, e.clientX, e.clientY)
        return
      }
      // Check transform handle hit first
      if (this.selectedLayerIds.length === 1) {
        const handleType = this.transformHandles.hitTest(e.globalX, e.globalY)
        if (handleType) {
          this.handleStagePointerDown(e)
          return
        }
      }
      if (e.target === this.app.stage) {
        // Start marquee selection if select tool is active
        const activeTool = useEditorStore.getState().activeTool
        if (activeTool === 'select') {
          if (!e.shiftKey) {
            this.onSelect?.(null)
          }
          this.startMarqueeSelection(e)
        } else {
          this.onSelect?.(null, e.shiftKey)
        }
      }
    })

    this.app.ticker.add(this.onTick.bind(this))
    this.initialized = true
  }

  setCallbacks(
    onSelect: SelectionCallback,
    onTransform: TransformCallback,
    onTransformEnd?: TransformEndCallback,
    onContextMenu?: ContextMenuCallback
  ): void {
    this.onSelect = onSelect
    this.onTransform = onTransform
    this.onTransformEnd = onTransformEnd ?? null
    this.onContextMenu = onContextMenu ?? null
  }

  setScene(project: Project, frame: number, selectedLayerIds: string[]): void {
    this.currentProject = project
    this.currentFrame = frame
    this.selectedLayerIds = selectedLayerIds
    this.dirty = true
  }

  private onTick(): void {
    if (!this.dirty || !this.currentProject) return
    this.dirty = false
    this.renderScene(this.currentProject, this.currentFrame)
  }

  private drawStageBg(w: number, h: number, bgColor: string): void {
    const key = `${w}:${h}:${bgColor}`
    if (key === this.lastBgKey) return
    this.lastBgKey = key

    this.stageBg.clear()
    // Shadow
    this.stageBg.rect(3, 3, w, h).fill({ color: 0x000000, alpha: 0.25 })
    // Fill
    this.stageBg.rect(0, 0, w, h).fill(bgColor)
    // Border
    this.stageBg.rect(0, 0, w, h).stroke({ color: 0x555555, width: 1, alpha: 0.8 })
  }

  private _prevLayerIds: string | null = null

  private renderScene(project: Project, frame: number): void {
    console.log('[renderScene] layers=', project.layers.length, 'frame=', frame, 'containers=', this.layerContainers.size)
    // Update background — workspace is dark gray, artboard is distinct
    this.app.renderer.background.color = '#111111'
    this.drawStageBg(project.width, project.height, project.backgroundColor || '#000000')

    // Sort layers by order (lower order = bottom)
    const sortedLayers = [...project.layers].sort((a, b) => a.order - b.order)

    // Track which layer IDs are still active
    const activeIds = new Set(project.layers.map((l) => l.id))

    // Detect layer set changes and force full rebuild
    const layerIdKey = [...activeIds].sort().join(',')
    if (this._prevLayerIds !== null && this._prevLayerIds !== layerIdKey) {
      console.log('[renderScene] Layer set changed, clearing all caches')
      for (const [, container] of this.layerContainers) {
        this.worldContainer.removeChild(container)
      }
      this.layerContainers.clear()
      this.spriteCache.clear()
      this.textCache.clear()
      this.shapeCache.clear()
    }
    this._prevLayerIds = layerIdKey

    // Remove stale containers
    for (const [id, container] of this.layerContainers) {
      if (!activeIds.has(id)) {
        this.worldContainer.removeChild(container)
        this.layerContainers.delete(id)
        this.spriteCache.delete(id)
        this.textCache.delete(id)
        this.shapeCache.delete(id)
      }
    }

    // ── Onion Skinning ──
    // Clean up previous onion skin containers
    if ((this as any)._onionContainers) {
      for (const c of (this as any)._onionContainers) {
        this.worldContainer.removeChild(c)
        c.destroy({ children: true })
      }
    }
    (this as any)._onionContainers = []

    const editorState = useEditorStore.getState()
    if (editorState.onionSkinEnabled) {
      const before = editorState.onionSkinBefore
      const after = editorState.onionSkinAfter

      // Render ghost frames (before = red tint, after = green tint)
      for (let offset = -before; offset <= after; offset++) {
        if (offset === 0) continue
        const ghostFrame = frame + offset
        if (ghostFrame < 0 || ghostFrame >= project.durationFrames) continue

        const ghostContainer = new PIXI.Container()
        const distance = Math.abs(offset)
        const maxDist = Math.max(before, after)
        const ghostAlpha = 0.15 + (1 - distance / (maxDist + 1)) * 0.2

        for (const layer of sortedLayers) {
          if (!layer.visible) continue
          if (ghostFrame < layer.startFrame || ghostFrame > layer.endFrame) continue

          const ghostProps = getInterpolatedProps(layer.tracks, ghostFrame, { ...DEFAULT_LAYER_PROPS })
          const ghostGfx = new PIXI.Graphics()

          if (layer.type === 'shape' && layer.shapeData) {
            this.drawShapeGraphics(ghostGfx, layer.shapeData, layer)
            ghostGfx.x = ghostProps.x
            ghostGfx.y = ghostProps.y
            ghostGfx.scale.set(ghostProps.scaleX, ghostProps.scaleY)
            ghostGfx.rotation = ghostProps.rotation
            ghostGfx.alpha = ghostProps.opacity
            ghostGfx.tint = offset < 0 ? 0xff6666 : 0x66ff66
            ghostContainer.addChild(ghostGfx)
          } else if (layer.type === 'image' && layer.assetId) {
            const asset = project.assets.find((a) => a.id === layer.assetId)
            if (asset) {
              const tex = this.textureCache.get(asset.id)
              if (tex) {
                const ghostSprite = new PIXI.Sprite(tex)
                ghostSprite.anchor.set(0.5, 0.5)
                ghostSprite.x = ghostProps.x
                ghostSprite.y = ghostProps.y
                ghostSprite.scale.set(ghostProps.scaleX, ghostProps.scaleY)
                ghostSprite.rotation = ghostProps.rotation
                ghostSprite.alpha = ghostProps.opacity
                ghostSprite.tint = offset < 0 ? 0xff6666 : 0x66ff66
                ghostContainer.addChild(ghostSprite)
              }
            }
          } else if (layer.type === 'text' && layer.textData) {
            const ghostText = new PIXI.Text({
              text: layer.textData.text,
              style: { fontFamily: layer.textData.font, fontSize: layer.textData.size, fill: offset < 0 ? '#ff6666' : '#66ff66' }
            })
            ghostText.anchor.set(0.5, 0.5)
            ghostText.x = ghostProps.x
            ghostText.y = ghostProps.y
            ghostText.scale.set(ghostProps.scaleX, ghostProps.scaleY)
            ghostText.rotation = ghostProps.rotation
            ghostText.alpha = ghostProps.opacity
            ghostContainer.addChild(ghostText)
          }
        }

        ghostContainer.alpha = ghostAlpha
        // Insert after stageBg (index 1) so ghosts are behind real content
        this.worldContainer.addChildAt(ghostContainer, 1)
        ;(this as any)._onionContainers.push(ghostContainer)
      }
    }

    // Render each layer
    for (const layer of sortedLayers) {
      if (!layer.visible) {
        const container = this.layerContainers.get(layer.id)
        if (container) container.visible = false
        continue
      }

      // Check frame range
      if (frame < layer.startFrame || frame > layer.endFrame) {
        const container = this.layerContainers.get(layer.id)
        if (container) container.visible = false
        continue
      }

      const props = getInterpolatedProps(layer.tracks, frame, { ...DEFAULT_LAYER_PROPS })
      // Semi-transparent mode
      if (layer.semiTransparent) {
        props.opacity = props.opacity * 0.25
      }

      if (layer.type === 'image') {
        // Resolve effective asset (supports frame-by-frame symbol swapping)
        let effectiveAssetId = layer.assetId
        if (layer.assetSwaps?.length) {
          const swap = layer.assetSwaps.find(
            (s) => frame >= s.startFrame && frame <= s.endFrame
          )
          if (swap) effectiveAssetId = swap.assetId
        }
        if (effectiveAssetId) {
          const asset = project.assets.find((a) => a.id === effectiveAssetId)
          if (asset) this.renderImageLayer(layer, asset, props)
        }
      } else if (layer.type === 'text' && layer.textData) {
        this.renderTextLayer(layer, props)
      } else if (layer.type === 'shape') {
        // Support morph shapes (shape keyframes)
        let activeShapeData = layer.shapeData
        if (layer.shapeKeyframes?.length) {
          const sorted = [...layer.shapeKeyframes].sort((a, b) => a.frame - b.frame)
          let match = sorted[0]
          for (const sk of sorted) {
            if (sk.frame <= frame) match = sk
            else break
          }
          activeShapeData = match.shapeData
        }
        if (activeShapeData) {
          // For morph shapes, invalidate cache if shape changed
          if (layer.shapeKeyframes?.length) {
            const cacheKey = layer.id
            const cached = this.shapeCache.get(cacheKey)
            if (cached && (cached as any)._lastShapeData !== activeShapeData) {
              cached.clear()
              this.drawShapeGraphics(cached, activeShapeData, layer)
              ;(cached as any)._lastShapeData = activeShapeData
            }
          }
          this.renderShapeLayer({ ...layer, shapeData: activeShapeData }, props)
        }
      } else if (layer.type === 'symbol' && layer.symbolId && project.symbols) {
        // Nested symbol timeline rendering
        const symbolDef = project.symbols.find((s) => s.id === layer.symbolId)
        if (symbolDef) {
          this.renderSymbolLayer(layer, symbolDef, project, frame, props)
        }
      }
    }

    // Ensure child order matches layer order (stageBg stays at index 0)
    let childIdx = 1 // Start after stageBg
    for (const layer of sortedLayers) {
      const container = this.layerContainers.get(layer.id)
      if (container && container.parent === this.worldContainer) {
        this.worldContainer.setChildIndex(container, childIdx)
        childIdx++
      }
    }

    // Apply mask relationships
    this.applyMasks(sortedLayers)

    // Disable sprite interaction when hand tool is active
    const isHand = useEditorStore.getState().activeTool === 'hand'
    const mode = isHand ? 'none' : 'static'
    for (const sprite of this.spriteCache.values()) {
      sprite.eventMode = mode
    }
    for (const text of this.textCache.values()) {
      text.eventMode = mode
    }
    for (const gfx of this.shapeCache.values()) {
      gfx.eventMode = mode
    }
    for (const container of this.layerContainers.values()) {
      if (container.cursor === 'pointer') container.eventMode = mode
    }

    // Draw selection overlay
    this.drawSelectionOverlay()
  }

  private renderImageLayer(layer: Layer, asset: Asset, props: InterpolatedProps): void {
    let container = this.layerContainers.get(layer.id)
    let sprite = this.spriteCache.get(layer.id)

    if (!sprite) {
      sprite = new PIXI.Sprite()
      sprite.anchor.set(0.5, 0.5)
      sprite.eventMode = 'static'
      sprite.cursor = 'pointer'
      sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this.handlePointerDown(e, layer.id))
      this.bindHoverEvents(sprite, layer.id)

      this.spriteCache.set(layer.id, sprite)

      container = new PIXI.Container()
      container.addChild(sprite)
      this.layerContainers.set(layer.id, container)
      this.worldContainer.addChild(container)
    } else {
      container = this.layerContainers.get(layer.id)!
    }

    // Load texture if needed
    const cachedTexture = this.textureCache.get(asset.id)

    if (!cachedTexture) {
      this.loadTextureViaImg(asset.localBundlePath).then((texture) => {
        this.textureCache.set(asset.id, texture)
        sprite!.texture = texture
        this.dirty = true
      })
    } else {
      sprite.texture = cachedTexture
    }

    // Apply transform
    container.visible = true
    sprite.x = 0
    sprite.y = 0
    container.x = props.x
    container.y = props.y
    container.scale.set(props.scaleX, props.scaleY)
    container.rotation = props.rotation
    container.alpha = props.opacity

    // Blend mode, tint, filters
    this.applyLayerEffects(sprite, layer)
  }

  private renderTextLayer(layer: Layer, props: InterpolatedProps): void {
    let container = this.layerContainers.get(layer.id)
    let text = this.textCache.get(layer.id)

    if (!text) {
      text = new PIXI.Text({
        text: layer.textData?.text ?? '',
        style: {
          fontFamily: layer.textData?.font ?? 'Arial',
          fontSize: layer.textData?.size ?? 36,
          fill: layer.textData?.color ?? '#ffffff'
        }
      })
      text.anchor.set(0.5, 0.5)
      text.eventMode = 'static'
      text.cursor = 'pointer'
      text.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this.handlePointerDown(e, layer.id))
      this.bindHoverEvents(text, layer.id)

      this.textCache.set(layer.id, text)

      container = new PIXI.Container()
      container.addChild(text)
      this.layerContainers.set(layer.id, container)
      this.worldContainer.addChild(container)
    } else {
      container = this.layerContainers.get(layer.id)!
    }

    // Update text content and style
    text.text = layer.textData?.text ?? ''
    const style = text.style as PIXI.TextStyle
    style.fontFamily = layer.textData?.font ?? 'Arial'
    style.fontSize = layer.textData?.size ?? 36
    style.fill = layer.textData?.color ?? '#ffffff'

    container.visible = true
    container.x = props.x
    container.y = props.y
    container.scale.set(props.scaleX, props.scaleY)
    container.rotation = props.rotation
    container.alpha = props.opacity

    // Blend mode, tint, filters
    this.applyLayerEffects(text, layer)
  }

  private renderShapeLayer(layer: Layer, props: InterpolatedProps): void {
    let container = this.layerContainers.get(layer.id)
    let gfx = this.shapeCache.get(layer.id)

    if (!gfx) {
      gfx = new PIXI.Graphics()
      gfx.eventMode = 'static'
      gfx.cursor = 'pointer'
      gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this.handlePointerDown(e, layer.id))
      this.bindHoverEvents(gfx, layer.id)

      // Draw all shape paths in document order to preserve stacking
      const shapeData = layer.shapeData!

      // Collect bitmap fill asset IDs that need texture loading
      const bitmapFillAssetIds = new Set<string>()
      for (const path of shapeData.paths) {
        if (path.bitmapFillAssetId) bitmapFillAssetIds.add(path.bitmapFillAssetId)
      }

      const drawPaths = (): void => {
        this.drawShapeGraphics(gfx!, shapeData, layer)
      }

      // Load any needed bitmap fill textures
      if (bitmapFillAssetIds.size > 0 && this.currentProject) {
        const loadPromises: Promise<void>[] = []
        for (const assetId of bitmapFillAssetIds) {
          if (this.textureCache.has(assetId)) continue
          const asset = this.currentProject.assets.find(a => a.id === assetId)
          if (!asset) continue
          loadPromises.push(
            this.loadTextureViaImg(asset.localBundlePath).then((texture) => {
              this.textureCache.set(assetId, texture)
            })
          )
        }
        if (loadPromises.length > 0) {
          // Draw with placeholders now, then redraw with textures when loaded
          drawPaths()
          Promise.all(loadPromises).then(() => {
            gfx!.clear()
            drawPaths()
            this.dirty = true
          })
        } else {
          drawPaths()
        }
      } else {
        drawPaths()
      }

      ;(gfx as any)._shapeDataRef = layer.shapeData
      this.shapeCache.set(layer.id, gfx)

      container = new PIXI.Container()
      container.addChild(gfx)
      this.layerContainers.set(layer.id, container)
      this.worldContainer.addChild(container)
    } else {
      // Invalidate cache if shapeData changed (e.g. user edited fill/stroke)
      if ((gfx as any)._shapeDataRef !== layer.shapeData) {
        this.shapeCache.delete(layer.id)
        this.layerContainers.get(layer.id)?.destroy({ children: true })
        this.layerContainers.delete(layer.id)
        return this.renderShapeLayer(layer, props)
      }
      container = this.layerContainers.get(layer.id)!
    }

    container.visible = true
    container.x = props.x
    container.y = props.y
    container.scale.set(props.scaleX, props.scaleY)
    container.rotation = props.rotation
    container.alpha = props.opacity

    // Blend mode, tint, filters
    this.applyLayerEffects(gfx, layer)
  }

  // ── Symbol Layer (nested timeline) ─────────────────────────────────────

  private renderSymbolLayer(
    layer: Layer,
    symbolDef: { durationFrames: number; layers: Layer[] },
    project: Project,
    parentFrame: number,
    props: InterpolatedProps
  ): void {
    let container = this.layerContainers.get(layer.id)
    if (!container) {
      container = new PIXI.Container()
      container.eventMode = 'static'
      container.cursor = 'pointer'
      container.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this.handlePointerDown(e, layer.id))
      this.bindHoverEvents(container, layer.id)
      this.layerContainers.set(layer.id, container)
      this.worldContainer.addChild(container)
    }

    container.visible = true
    container.x = props.x
    container.y = props.y
    container.scale.set(props.scaleX, props.scaleY)
    container.rotation = props.rotation
    container.alpha = props.opacity

    // Calculate internal frame (looping)
    const internalFrame =
      symbolDef.durationFrames > 0
        ? (parentFrame - layer.startFrame) % symbolDef.durationFrames
        : 0

    // Render symbol's internal layers into this container
    for (const symLayer of symbolDef.layers) {
      if (!symLayer.visible) continue
      if (internalFrame < symLayer.startFrame || internalFrame > symLayer.endFrame) continue

      const symProps = getInterpolatedProps(symLayer.tracks, internalFrame, {
        ...DEFAULT_LAYER_PROPS
      })

      // Use a prefixed cache key to avoid conflicts with main timeline
      const cacheKey = layer.id + ':' + symLayer.id
      if (symLayer.type === 'shape' && symLayer.shapeData) {
        let gfx = this.shapeCache.get(cacheKey)
        if (!gfx) {
          gfx = new PIXI.Graphics()
          this.drawShapeGraphics(gfx, symLayer.shapeData, symLayer)
          this.shapeCache.set(cacheKey, gfx)
          container.addChild(gfx)

          // Load bitmap fill textures if needed
          for (const path of symLayer.shapeData.paths) {
            if (path.bitmapFillAssetId && !this.textureCache.has(path.bitmapFillAssetId)) {
              const asset = project.assets.find((a) => a.id === path.bitmapFillAssetId)
              if (asset) {
                this.loadTextureViaImg(asset.localBundlePath).then((tex) => {
                  this.textureCache.set(path.bitmapFillAssetId!, tex)
                  // Redraw with loaded texture
                  gfx!.clear()
                  this.drawShapeGraphics(gfx!, symLayer.shapeData!, symLayer)
                  this.dirty = true
                })
              }
            }
          }
        }
        gfx.visible = true
        gfx.x = symProps.x - symLayer.shapeData.originX
        gfx.y = symProps.y - symLayer.shapeData.originY
        gfx.scale.set(symProps.scaleX, symProps.scaleY)
        gfx.rotation = symProps.rotation
        gfx.alpha = symProps.opacity
      } else if (symLayer.type === 'image' && symLayer.assetId) {
        const asset = project.assets.find((a) => a.id === symLayer.assetId)
        if (!asset) continue
        let sprite = this.spriteCache.get(cacheKey)
        if (!sprite) {
          sprite = new PIXI.Sprite()
          sprite.anchor.set(0.5, 0.5)
          this.spriteCache.set(cacheKey, sprite)
          container.addChild(sprite)
        }
        const tex = this.textureCache.get(asset.id)
        if (tex) sprite.texture = tex
        else {
          this.loadTextureViaImg(asset.localBundlePath).then((t) => {
            this.textureCache.set(asset.id, t)
            sprite!.texture = t
            this.dirty = true
          })
        }
        sprite.visible = true
        sprite.x = symProps.x
        sprite.y = symProps.y
        sprite.scale.set(symProps.scaleX, symProps.scaleY)
        sprite.rotation = symProps.rotation
        sprite.alpha = symProps.opacity
      } else if (symLayer.type === 'text' && symLayer.textData) {
        let text = this.textCache.get(cacheKey)
        if (!text) {
          text = new PIXI.Text({
            text: symLayer.textData.text,
            style: {
              fontFamily: symLayer.textData.font ?? 'Arial',
              fontSize: symLayer.textData.size ?? 36,
              fill: symLayer.textData.color ?? '#ffffff'
            }
          })
          text.anchor.set(0.5, 0.5)
          this.textCache.set(cacheKey, text)
          container.addChild(text)
        }
        // Update text content/style in case it changed
        text.text = symLayer.textData.text
        const style = text.style as PIXI.TextStyle
        style.fontFamily = symLayer.textData.font ?? 'Arial'
        style.fontSize = symLayer.textData.size ?? 36
        style.fill = symLayer.textData.color ?? '#ffffff'

        text.visible = true
        text.x = symProps.x
        text.y = symProps.y
        text.scale.set(symProps.scaleX, symProps.scaleY)
        text.rotation = symProps.rotation
        text.alpha = symProps.opacity
      } else if (symLayer.type === 'symbol' && symLayer.symbolId && project.symbols) {
        // Recursive nested symbol rendering (with depth guard)
        const nestedSymbolDef = project.symbols.find((s) => s.id === symLayer.symbolId)
        if (nestedSymbolDef) {
          const depth = (layer as any)._symbolDepth ?? 0
          if (depth < 8) {
            // Create a sub-container for the nested symbol
            let nestedContainer = this.layerContainers.get(cacheKey)
            if (!nestedContainer) {
              nestedContainer = new PIXI.Container()
              this.layerContainers.set(cacheKey, nestedContainer)
              container.addChild(nestedContainer)
            }
            nestedContainer.visible = true
            nestedContainer.x = symProps.x
            nestedContainer.y = symProps.y
            nestedContainer.scale.set(symProps.scaleX, symProps.scaleY)
            nestedContainer.rotation = symProps.rotation
            nestedContainer.alpha = symProps.opacity

            // Calculate nested symbol's internal frame
            const nestedInternalFrame =
              nestedSymbolDef.durationFrames > 0
                ? (internalFrame - symLayer.startFrame) % nestedSymbolDef.durationFrames
                : 0

            // Tag the synthetic layer with depth to prevent infinite recursion
            const syntheticLayer = {
              ...symLayer,
              id: cacheKey,
              _symbolDepth: depth + 1
            } as Layer & { _symbolDepth: number }

            this.renderSymbolLayer(
              syntheticLayer,
              nestedSymbolDef,
              project,
              nestedInternalFrame + symLayer.startFrame,
              symProps
            )
          }
        }
      }
    }
  }

  // ── Shape Drawing Helper ──────────────────────────────────────────────

  /** Trace segments onto a PIXI.GraphicsPath, offsetting by origin. */
  private traceSegments(gpath: PIXI.GraphicsPath, segments: ShapeSegment[], ox: number, oy: number): void {
    for (const seg of segments) {
      switch (seg.type) {
        case 'move':
          gpath.moveTo(seg.x - ox, seg.y - oy)
          break
        case 'line':
          gpath.lineTo(seg.x - ox, seg.y - oy)
          break
        case 'cubic':
          gpath.bezierCurveTo(
            seg.cx1 - ox, seg.cy1 - oy,
            seg.cx2 - ox, seg.cy2 - oy,
            seg.x - ox, seg.y - oy
          )
          break
        case 'quadratic':
          gpath.quadraticCurveTo(seg.cx - ox, seg.cy - oy, seg.x - ox, seg.y - oy)
          break
        case 'close':
          gpath.closePath()
          break
      }
    }
  }

  /** Trace segments directly onto a PIXI.Graphics context (for sub-path holes and strokes). */
  private traceSegmentsOnGraphics(gfx: PIXI.Graphics, segments: ShapeSegment[], ox: number, oy: number): void {
    for (const seg of segments) {
      switch (seg.type) {
        case 'move':
          gfx.moveTo(seg.x - ox, seg.y - oy)
          break
        case 'line':
          gfx.lineTo(seg.x - ox, seg.y - oy)
          break
        case 'cubic':
          gfx.bezierCurveTo(
            seg.cx1 - ox, seg.cy1 - oy,
            seg.cx2 - ox, seg.cy2 - oy,
            seg.x - ox, seg.y - oy
          )
          break
        case 'quadratic':
          gfx.quadraticCurveTo(seg.cx - ox, seg.cy - oy, seg.x - ox, seg.y - oy)
          break
        case 'close':
          gfx.closePath()
          break
      }
    }
  }

  private drawShapeGraphics(gfx: PIXI.Graphics, shapeData: ShapeData, _layer: Layer): void {
    const ox = shapeData.originX
    const oy = shapeData.originY

    for (const path of shapeData.paths) {
      const segs = path.segments

      // Draw fill
      if ((path.fillColor || path.bitmapFillAssetId) && segs.length >= 2) {
        const gpath = new PIXI.GraphicsPath()
        this.traceSegments(gpath, segs, ox, oy)
        gfx.path(gpath)
        if (path.bitmapFillAssetId) {
          const tex = this.textureCache.get(path.bitmapFillAssetId)
          if (tex) gfx.fill({ texture: tex })
          else gfx.fill('#888888')
        } else {
          gfx.fill(path.fillColor!)
        }
        // Draw sub-paths as holes
        if (path.subPaths) {
          for (const sub of path.subPaths) {
            if (sub.length < 2) continue
            this.traceSegmentsOnGraphics(gfx, sub, ox, oy)
            gfx.cut()
          }
        }
      }

      // Draw stroke
      if (path.strokeColor && segs.length >= 2) {
        this.traceSegmentsOnGraphics(gfx, segs, ox, oy)
        gfx.stroke({ color: path.strokeColor, width: path.strokeWidth || 1, join: 'round', cap: 'round' })
      }
    }
  }

  // ── Layer Effects (Blend, Tint, Filters) ──────────────────────────────

  private applyLayerEffects(
    displayObj: PIXI.Sprite | PIXI.Text | PIXI.Graphics,
    layer: Layer
  ): void {
    // Blend mode
    if (layer.blendMode && layer.blendMode !== 'normal') {
      displayObj.blendMode = layer.blendMode as PIXI.BLEND_MODES
    } else {
      displayObj.blendMode = 'normal' as PIXI.BLEND_MODES
    }

    // Tint (only for sprites and text — Graphics doesn't support tint directly)
    if ('tint' in displayObj) {
      if (layer.tintColor) {
        (displayObj as any).tint = parseInt(layer.tintColor.replace('#', ''), 16)
      } else {
        (displayObj as any).tint = 0xffffff
      }
    }

    // Filters
    if (layer.filters && layer.filters.length > 0) {
      const pixiFilters: PIXI.Filter[] = []
      for (const f of layer.filters) {
        if (!f.enabled) continue
        if (f.type === 'blur') {
          pixiFilters.push(new PIXI.BlurFilter({ strength: f.blurX ?? 4 }))
        }
        // DropShadow and Glow require pixi-filters — add when available
      }
      displayObj.filters = pixiFilters.length > 0 ? pixiFilters : null
    } else {
      displayObj.filters = null
    }
  }

  // ── Mask Application Pass ─────────────────────────────────────────────

  private applyMasks(layers: Layer[]): void {
    for (const layer of layers) {
      if (!layer.maskLayerId) continue
      const maskContainer = this.layerContainers.get(layer.maskLayerId)
      const targetContainer = this.layerContainers.get(layer.id)
      if (maskContainer && targetContainer) {
        targetContainer.mask = maskContainer
      }
    }
  }

  private drawSelectionOverlay(): void {
    this.selectionOverlay.clear()
    this.transformHandles.clear()

    // Draw hover outline for non-selected layers
    if (this.hoveredLayerId && !this.selectedLayerIds.includes(this.hoveredLayerId)) {
      const hoverContainer = this.layerContainers.get(this.hoveredLayerId)
      if (hoverContainer && hoverContainer.visible) {
        const hoverBounds = hoverContainer.getBounds()
        this.selectionOverlay
          .rect(hoverBounds.x, hoverBounds.y, hoverBounds.width, hoverBounds.height)
          .stroke({ color: 0x4a9eff, width: 1, alpha: 0.4 })
      }
    }

    if (this.selectedLayerIds.length === 0) return

    for (const layerId of this.selectedLayerIds) {
      const container = this.layerContainers.get(layerId)
      if (!container || !container.visible) continue

      const bounds = container.getBounds()
      this.selectionOverlay
        .rect(bounds.x, bounds.y, bounds.width, bounds.height)
        .stroke({ color: 0x4a9eff, width: 2, alpha: 1 })

      // Show transform handles for single selection only
      if (this.selectedLayerIds.length === 1) {
        this.transformHandles.draw(bounds)
      }
    }
  }

  private handleStagePointerDown(e: PIXI.FederatedPointerEvent): void {
    // Check if clicking a transform handle (only when single-selected)
    if (this.selectedLayerIds.length === 1) {
      const handleType = this.transformHandles.hitTest(e.globalX, e.globalY)
      if (handleType) {
        e.stopPropagation()
        const layerId = this.selectedLayerIds[0]
        const props = this.getCurrentProps(layerId)
        if (!props) return

        this.dragLayerId = layerId
        this.dragStartPointer = { x: e.globalX, y: e.globalY }
        this.dragStartProps = {
          x: props.x, y: props.y,
          scaleX: props.scaleX, scaleY: props.scaleY,
          rotation: props.rotation
        }
        this.isDragging = true
        this.dragMode = handleType
        this.bindDragListeners(layerId)
        return
      }
    }
  }

  private handlePointerDown(e: PIXI.FederatedPointerEvent, layerId: string): void {
    e.stopPropagation()

    // Check if layer is locked — allow selection but not dragging
    const layer = this.currentProject?.layers.find((l) => l.id === layerId)
    const isLocked = layer?.locked ?? false

    // Right-click → context menu (always allowed, even on locked)
    if (e.button === 2) {
      if (!this.selectedLayerIds.includes(layerId)) {
        this.onSelect?.(layerId)
        this.selectedLayerIds = [layerId]
      }
      this.onContextMenu?.(layerId, e.clientX, e.clientY)
      return
    }

    // Locked layers can be selected but not transformed
    if (isLocked) {
      this.onSelect?.(layerId, e.shiftKey)
      if (e.shiftKey) {
        if (this.selectedLayerIds.includes(layerId)) {
          this.selectedLayerIds = this.selectedLayerIds.filter((id) => id !== layerId)
        } else {
          this.selectedLayerIds = [...this.selectedLayerIds, layerId]
        }
      } else {
        this.selectedLayerIds = [layerId]
      }
      this.drawSelectionOverlay()
      return
    }

    // Check if clicking a transform handle first
    if (this.selectedLayerIds.length === 1 && this.selectedLayerIds[0] === layerId) {
      const handleType = this.transformHandles.hitTest(e.globalX, e.globalY)
      if (handleType) {
        const props = this.getCurrentProps(layerId)
        if (!props) return
        this.dragLayerId = layerId
        this.dragStartPointer = { x: e.globalX, y: e.globalY }
        this.dragStartProps = {
          x: props.x, y: props.y,
          scaleX: props.scaleX, scaleY: props.scaleY,
          rotation: props.rotation
        }
        this.isDragging = true
        this.dragMode = handleType
        this.bindDragListeners(layerId)
        return
      }
    }

    this.onSelect?.(layerId, e.shiftKey)

    // Update local selection state
    if (e.shiftKey) {
      if (this.selectedLayerIds.includes(layerId)) {
        this.selectedLayerIds = this.selectedLayerIds.filter((id) => id !== layerId)
      } else {
        this.selectedLayerIds = [...this.selectedLayerIds, layerId]
      }
    } else {
      this.selectedLayerIds = [layerId]
    }

    const props = this.getCurrentProps(layerId)
    if (!props) return

    this.dragLayerId = layerId
    this.dragStartPointer = { x: e.globalX, y: e.globalY }
    this.dragStartProps = {
      x: props.x, y: props.y,
      scaleX: props.scaleX, scaleY: props.scaleY,
      rotation: props.rotation
    }
    this.isDragging = true
    this.dragMode = 'move'
    this.bindDragListeners(layerId)
  }

  private bindDragListeners(layerId: string): void {
    const moveFn = (e: PIXI.FederatedPointerEvent): void => this.handlePointerMove(e)
    const upFn = (): void => this.handlePointerUp(layerId, moveFn, upFn)
    this.app.stage.on('pointermove', moveFn)
    this.app.stage.on('pointerup', upFn)
    this.app.stage.on('pointerupoutside', upFn)
  }

  private handlePointerMove(e: PIXI.FederatedPointerEvent): void {
    if (!this.isDragging || !this.dragLayerId) return

    const scale = this.currentZoom || 1

    if (this.dragMode === 'move') {
      const dx = (e.globalX - this.dragStartPointer.x) / scale
      const dy = (e.globalY - this.dragStartPointer.y) / scale
      const newX = this.dragStartProps.x + dx
      const newY = this.dragStartProps.y + dy

      const container = this.layerContainers.get(this.dragLayerId)
      if (container) {
        container.x = newX
        container.y = newY
        this.drawSelectionOverlay()
      }
      this.onTransform?.(this.dragLayerId, { x: newX, y: newY })

    } else if (this.dragMode === 'rotate') {
      // Rotate around the center of the selection
      const container = this.layerContainers.get(this.dragLayerId)
      if (!container) return

      const center = this.transformHandles.getCenter()
      const startAngle = Math.atan2(
        this.dragStartPointer.y - center.y,
        this.dragStartPointer.x - center.x
      )
      const currentAngle = Math.atan2(
        e.globalY - center.y,
        e.globalX - center.x
      )
      let newRotation = this.dragStartProps.rotation + (currentAngle - startAngle)

      // Shift constrains to 15-degree increments
      if (e.shiftKey) {
        const step = Math.PI / 12
        newRotation = Math.round(newRotation / step) * step
      }

      container.rotation = newRotation
      this.drawSelectionOverlay()
      this.onTransform?.(this.dragLayerId, { rotation: newRotation })

    } else if (this.dragMode.startsWith('scale-')) {
      this.handleScaleDrag(e)
    }
  }

  private handleScaleDrag(e: PIXI.FederatedPointerEvent): void {
    if (!this.dragLayerId) return
    const container = this.layerContainers.get(this.dragLayerId)
    if (!container) return

    const scale = this.currentZoom || 1
    const dx = (e.globalX - this.dragStartPointer.x) / scale
    const dy = (e.globalY - this.dragStartPointer.y) / scale

    let newScaleX = this.dragStartProps.scaleX
    let newScaleY = this.dragStartProps.scaleY

    const mode = this.dragMode
    // Determine which axes to scale
    const scalesX = mode === 'scale-tl' || mode === 'scale-tr' || mode === 'scale-bl' || mode === 'scale-br' || mode === 'scale-l' || mode === 'scale-r'
    const scalesY = mode === 'scale-tl' || mode === 'scale-tr' || mode === 'scale-bl' || mode === 'scale-br' || mode === 'scale-t' || mode === 'scale-b'

    // Get the bounds width/height to calculate scale ratio from drag distance
    const bounds = container.getBounds()
    const boundsW = bounds.width / Math.abs(this.dragStartProps.scaleX) || 1
    const boundsH = bounds.height / Math.abs(this.dragStartProps.scaleY) || 1

    // Flip sign based on which direction the handle is
    const flipX = (mode === 'scale-tl' || mode === 'scale-bl' || mode === 'scale-l') ? -1 : 1
    const flipY = (mode === 'scale-tl' || mode === 'scale-tr' || mode === 'scale-t') ? -1 : 1

    if (scalesX) {
      newScaleX = this.dragStartProps.scaleX + (dx * flipX) / boundsW
    }
    if (scalesY) {
      newScaleY = this.dragStartProps.scaleY + (dy * flipY) / boundsH
    }

    // Shift constrains to uniform scale
    if (e.shiftKey && scalesX && scalesY) {
      const avg = (Math.abs(newScaleX) + Math.abs(newScaleY)) / 2
      newScaleX = avg * Math.sign(newScaleX || 1)
      newScaleY = avg * Math.sign(newScaleY || 1)
    }

    container.scale.set(newScaleX, newScaleY)
    this.drawSelectionOverlay()
    this.onTransform?.(this.dragLayerId, { scaleX: newScaleX, scaleY: newScaleY })
  }

  private handlePointerUp(
    layerId: string,
    moveFn: (e: PIXI.FederatedPointerEvent) => void,
    upFn: () => void
  ): void {
    if (!this.isDragging) return

    // Commit transform as undoable command
    if (this.dragMode !== 'none') {
      const afterProps = this.getCurrentProps(layerId)
      if (afterProps && this.onTransformEnd) {
        const before: Partial<InterpolatedProps> = {}
        const after: Partial<InterpolatedProps> = {}

        if (this.dragMode === 'move') {
          before.x = this.dragStartProps.x
          before.y = this.dragStartProps.y
          after.x = afterProps.x
          after.y = afterProps.y
        } else if (this.dragMode === 'rotate') {
          before.rotation = this.dragStartProps.rotation
          after.rotation = afterProps.rotation
        } else if (this.dragMode.startsWith('scale-')) {
          before.scaleX = this.dragStartProps.scaleX
          before.scaleY = this.dragStartProps.scaleY
          after.scaleX = afterProps.scaleX
          after.scaleY = afterProps.scaleY
        }

        // Only commit if something actually changed
        const changed = Object.keys(after).some(
          (k) => (after as any)[k] !== (before as any)[k]
        )
        if (changed) {
          this.onTransformEnd(layerId, before, after)
        }
      }
    }

    this.isDragging = false
    this.dragLayerId = null
    this.dragMode = 'none'
    this.app.stage.off('pointermove', moveFn)
    this.app.stage.off('pointerup', upFn)
    this.app.stage.off('pointerupoutside', upFn)
  }

  // ── Marquee Selection ──────────────────────────────────────────────

  private startMarqueeSelection(e: PIXI.FederatedPointerEvent): void {
    this.isMarqueeSelecting = true
    this.marqueeStart = { x: e.globalX, y: e.globalY }
    this.marqueeEnd = { x: e.globalX, y: e.globalY }

    const moveFn = (ev: PIXI.FederatedPointerEvent): void => {
      this.marqueeEnd = { x: ev.globalX, y: ev.globalY }
      this.drawMarquee()
    }

    const upFn = (): void => {
      this.isMarqueeSelecting = false
      this.marqueeGraphics.clear()
      this.finishMarqueeSelection()
      this.app.stage.off('pointermove', moveFn)
      this.app.stage.off('pointerup', upFn)
      this.app.stage.off('pointerupoutside', upFn)
    }

    this.app.stage.on('pointermove', moveFn)
    this.app.stage.on('pointerup', upFn)
    this.app.stage.on('pointerupoutside', upFn)
  }

  private drawMarquee(): void {
    this.marqueeGraphics.clear()
    const x = Math.min(this.marqueeStart.x, this.marqueeEnd.x)
    const y = Math.min(this.marqueeStart.y, this.marqueeEnd.y)
    const w = Math.abs(this.marqueeEnd.x - this.marqueeStart.x)
    const h = Math.abs(this.marqueeEnd.y - this.marqueeStart.y)

    this.marqueeGraphics
      .rect(x, y, w, h)
      .fill({ color: 0x4a9eff, alpha: 0.1 })
    this.marqueeGraphics
      .rect(x, y, w, h)
      .stroke({ color: 0x4a9eff, width: 1, alpha: 0.6 })
  }

  private finishMarqueeSelection(): void {
    const x1 = Math.min(this.marqueeStart.x, this.marqueeEnd.x)
    const y1 = Math.min(this.marqueeStart.y, this.marqueeEnd.y)
    const x2 = Math.max(this.marqueeStart.x, this.marqueeEnd.x)
    const y2 = Math.max(this.marqueeStart.y, this.marqueeEnd.y)

    // Don't do anything for tiny drags (could be a misclick)
    if (x2 - x1 < 3 && y2 - y1 < 3) return

    const hitIds: string[] = []
    for (const [layerId, container] of this.layerContainers) {
      if (!container.visible) continue
      const layer = this.currentProject?.layers.find((l) => l.id === layerId)
      if (!layer || layer.locked) continue

      const bounds = container.getBounds()
      // Check intersection
      if (
        bounds.x + bounds.width > x1 && bounds.x < x2 &&
        bounds.y + bounds.height > y1 && bounds.y < y2
      ) {
        hitIds.push(layerId)
      }
    }

    if (hitIds.length > 0) {
      // If shift was held at start, we already kept existing selection
      const existing = useEditorStore.getState().selectedLayerIds
      const merged = [...new Set([...existing, ...hitIds])]
      this.selectedLayerIds = merged
      useEditorStore.getState().setSelectedLayerIds(merged)
    }
  }

  /** Convert PixiJS canvas-relative coords to screen (page) coords */
  private canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect()
    return {
      x: rect.left + canvasX,
      y: rect.top + canvasY
    }
  }

  private bindHoverEvents(displayObj: PIXI.Container, layerId: string): void {
    displayObj.on('pointerover', () => {
      this.hoveredLayerId = layerId
      this.dirty = true
    })
    displayObj.on('pointerout', () => {
      if (this.hoveredLayerId === layerId) {
        this.hoveredLayerId = null
        this.dirty = true
      }
    })
  }

  private getCurrentProps(layerId: string): InterpolatedProps | null {
    const layer = this.currentProject?.layers.find((l) => l.id === layerId)
    if (!layer) return null
    return getInterpolatedProps(layer.tracks, this.currentFrame, { ...DEFAULT_LAYER_PROPS })
  }

  /**
   * Apply viewport zoom/pan so the project canvas is positioned on screen
   */
  applyViewport(
    containerW: number,
    containerH: number,
    projectW: number,
    projectH: number,
    zoom: number,
    panX: number,
    panY: number
  ): void {
    const cx = (containerW - projectW * zoom) / 2 + panX
    const cy = (containerH - projectH * zoom) / 2 + panY

    this.worldContainer.scale.set(zoom)
    this.worldContainer.x = cx
    this.worldContainer.y = cy

    this.currentZoom = zoom
  }

  resize(width: number, height: number): void {
    if (!this.initialized) return
    this.app.renderer.resize(width, height)
    this.dirty = true
  }

  private loadTextureViaImg(filePath: string): Promise<PIXI.Texture> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(PIXI.Texture.from(img))
      img.onerror = reject
      img.src = `file://${filePath.replace(/\\/g, '/')}`
    })
  }

  destroy(): void {
    if (!this.initialized) return
    this.initialized = false // prevent double-destroy
    try {
      // Patch PixiJS v8 bug: ResizableRenderer plugin may not have set _cancelResize
      // if destroy is called in certain timing windows after init.
      const app = this.app as unknown as Record<string, unknown>
      if (typeof app['_cancelResize'] !== 'function') {
        app['_cancelResize'] = (): void => { /* no-op */ }
      }
      // removeView=true removes the PixiJS-owned canvas from the DOM
      this.app.destroy(true, { children: true, texture: true })
    } catch {
      // suppress any remaining PixiJS internal errors during cleanup
    }
  }
}
