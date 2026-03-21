import * as PIXI from 'pixi.js'
import type { Project, Layer, Asset, ShapeData } from '../types/project'
import { DEFAULT_LAYER_PROPS } from '../types/project'
import type { InterpolatedProps } from './interpolation'
import { getInterpolatedProps } from './interpolation'
import { useEditorStore } from '../store/editorStore'

type SelectionCallback = (layerId: string | null) => void
type TransformCallback = (layerId: string, props: Partial<InterpolatedProps>) => void

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

  // Drag state
  private dragLayerId: string | null = null
  private dragStartPointer = { x: 0, y: 0 }
  private dragStartProps = { x: 0, y: 0 }
  private isDragging = false
  private currentZoom = 1

  // Current state
  private currentProject: Project | null = null
  private currentFrame = 0
  private selectedLayerId: string | null = null
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

    this.app.stage.eventMode = 'static'
    this.app.stage.hitArea = this.app.screen

    // Click on empty stage deselects
    this.app.stage.on('pointerdown', (e) => {
      if (e.target === this.app.stage) {
        this.onSelect?.(null)
      }
    })

    this.app.ticker.add(this.onTick.bind(this))
    this.initialized = true
  }

  setCallbacks(onSelect: SelectionCallback, onTransform: TransformCallback): void {
    this.onSelect = onSelect
    this.onTransform = onTransform
  }

  setScene(project: Project, frame: number, selectedLayerId: string | null): void {
    this.currentProject = project
    this.currentFrame = frame
    this.selectedLayerId = selectedLayerId
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

  private renderScene(project: Project, frame: number): void {
    // Update background — workspace is dark gray, artboard is distinct
    this.app.renderer.background.color = '#111111'
    this.drawStageBg(project.width, project.height, project.backgroundColor || '#000000')

    // Sort layers by order (lower order = bottom)
    const sortedLayers = [...project.layers].sort((a, b) => a.order - b.order)

    // Track which layer IDs are still active
    const activeIds = new Set(project.layers.map((l) => l.id))

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
      sprite.on('pointerdown', (e) => this.handlePointerDown(e, layer.id))
      sprite.on('pointermove', (e) => this.handlePointerMove(e))
      sprite.on('pointerup', () => this.handlePointerUp(layer.id))
      sprite.on('pointerupoutside', () => this.handlePointerUp(layer.id))

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
      text.on('pointerdown', (e) => this.handlePointerDown(e, layer.id))
      text.on('pointermove', (e) => this.handlePointerMove(e))
      text.on('pointerup', () => this.handlePointerUp(layer.id))
      text.on('pointerupoutside', () => this.handlePointerUp(layer.id))

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
      gfx.on('pointerdown', (e) => this.handlePointerDown(e, layer.id))
      gfx.on('pointermove', (e) => this.handlePointerMove(e))
      gfx.on('pointerup', () => this.handlePointerUp(layer.id))
      gfx.on('pointerupoutside', () => this.handlePointerUp(layer.id))

      // Draw all shape paths in document order to preserve stacking
      const shapeData = layer.shapeData!

      // Collect bitmap fill asset IDs that need texture loading
      const bitmapFillAssetIds = new Set<string>()
      for (const path of shapeData.paths) {
        if (path.bitmapFillAssetId) bitmapFillAssetIds.add(path.bitmapFillAssetId)
      }

      // Load bitmap fill textures then draw
      // Two-pass rendering: fills first, then strokes on top (matches Flash rendering order)
      const drawPaths = (): void => {
        // Pass 1: Draw all fills
        for (const path of shapeData.paths) {
          const pts = path.points
          if ((path.fillColor || path.bitmapFillAssetId) && pts.length >= 3) {
            const gpath = new PIXI.GraphicsPath()
            gpath.moveTo(pts[0].x - shapeData.originX, pts[0].y - shapeData.originY)
            for (let i = 1; i < pts.length; i++) {
              gpath.lineTo(pts[i].x - shapeData.originX, pts[i].y - shapeData.originY)
            }
            gpath.closePath()
            gfx!.path(gpath)
            if (path.bitmapFillAssetId) {
              const tex = this.textureCache.get(path.bitmapFillAssetId)
              if (tex) {
                gfx!.fill({ texture: tex })
              } else {
                gfx!.fill('#888888') // placeholder until texture loads
              }
            } else {
              gfx!.fill(path.fillColor!)
            }
            // Draw sub-paths as holes using PixiJS cut()
            if (path.subPaths) {
              for (const sub of path.subPaths) {
                if (sub.length < 3) continue
                gfx!.moveTo(sub[0].x - shapeData.originX, sub[0].y - shapeData.originY)
                for (let i = 1; i < sub.length; i++) {
                  gfx!.lineTo(sub[i].x - shapeData.originX, sub[i].y - shapeData.originY)
                }
                gfx!.closePath()
                gfx!.cut()
              }
            }
          }
        }
        // Pass 2: Draw all strokes on top of fills
        for (const path of shapeData.paths) {
          const pts = path.points
          if (path.strokeColor && pts.length >= 2) {
            gfx!.moveTo(pts[0].x - shapeData.originX, pts[0].y - shapeData.originY)
            for (let i = 1; i < pts.length; i++) {
              gfx!.lineTo(pts[i].x - shapeData.originX, pts[i].y - shapeData.originY)
            }
            gfx!.stroke({ color: path.strokeColor, width: path.strokeWidth || 1, join: 'round', cap: 'round' })
          }
        }
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

      this.shapeCache.set(layer.id, gfx)

      container = new PIXI.Container()
      container.addChild(gfx)
      this.layerContainers.set(layer.id, container)
      this.worldContainer.addChild(container)
    } else {
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
    // For now, just render shapes/images from the symbol's first frame
    // Full recursive rendering would require refactoring render methods to accept target container
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
      }
    }
  }

  // ── Shape Drawing Helper ──────────────────────────────────────────────

  private drawShapeGraphics(gfx: PIXI.Graphics, shapeData: ShapeData, layer: Layer): void {
    // Two-pass rendering: fills first, then strokes on top (matches Flash rendering order)
    // Pass 1: Draw all fills
    for (const path of shapeData.paths) {
      const pts = path.points
      if ((path.fillColor || path.bitmapFillAssetId) && pts.length >= 3) {
        const gpath = new PIXI.GraphicsPath()
        gpath.moveTo(pts[0].x - shapeData.originX, pts[0].y - shapeData.originY)
        for (let i = 1; i < pts.length; i++) {
          gpath.lineTo(pts[i].x - shapeData.originX, pts[i].y - shapeData.originY)
        }
        gpath.closePath()
        gfx.path(gpath)
        if (path.bitmapFillAssetId) {
          const tex = this.textureCache.get(path.bitmapFillAssetId)
          if (tex) gfx.fill({ texture: tex })
          else gfx.fill('#888888')
        } else {
          gfx.fill(path.fillColor!)
        }
        // Draw sub-paths as holes using PixiJS cut()
        if (path.subPaths) {
          for (const sub of path.subPaths) {
            if (sub.length < 3) continue
            gfx.moveTo(sub[0].x - shapeData.originX, sub[0].y - shapeData.originY)
            for (let i = 1; i < sub.length; i++) {
              gfx.lineTo(sub[i].x - shapeData.originX, sub[i].y - shapeData.originY)
            }
            gfx.closePath()
            gfx.cut()
          }
        }
      }
    }
    // Pass 2: Draw all strokes on top of fills
    for (const path of shapeData.paths) {
      const pts = path.points
      if (path.strokeColor && pts.length >= 2) {
        gfx.moveTo(pts[0].x - shapeData.originX, pts[0].y - shapeData.originY)
        for (let i = 1; i < pts.length; i++) {
          gfx.lineTo(pts[i].x - shapeData.originX, pts[i].y - shapeData.originY)
        }
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

    if (!this.selectedLayerId) return
    const container = this.layerContainers.get(this.selectedLayerId)
    if (!container || !container.visible) return

    const bounds = container.getBounds()
    this.selectionOverlay
      .rect(bounds.x, bounds.y, bounds.width, bounds.height)
      .stroke({ color: 0x4a9eff, width: 2, alpha: 1 })
  }

  private handlePointerDown(e: PIXI.FederatedPointerEvent, layerId: string): void {
    e.stopPropagation()
    this.onSelect?.(layerId)
    this.selectedLayerId = layerId

    const props = this.getCurrentProps(layerId)
    if (!props) return

    this.dragLayerId = layerId
    this.dragStartPointer = { x: e.globalX, y: e.globalY }
    this.dragStartProps = { x: props.x, y: props.y }
    this.isDragging = true

    this.app.stage.on('pointermove', this.handlePointerMove.bind(this))
    this.app.stage.on('pointerup', () => this.handlePointerUp(layerId))
    this.app.stage.on('pointerupoutside', () => this.handlePointerUp(layerId))
  }

  private handlePointerMove(e: PIXI.FederatedPointerEvent): void {
    if (!this.isDragging || !this.dragLayerId) return

    const scale = this.currentZoom || 1
    const dx = (e.globalX - this.dragStartPointer.x) / scale
    const dy = (e.globalY - this.dragStartPointer.y) / scale

    const newX = this.dragStartProps.x + dx
    const newY = this.dragStartProps.y + dy

    // Live update container position
    const container = this.layerContainers.get(this.dragLayerId)
    if (container) {
      container.x = newX
      container.y = newY
      this.drawSelectionOverlay()
    }

    this.onTransform?.(this.dragLayerId, { x: newX, y: newY })
  }

  private handlePointerUp(layerId: string): void {
    if (!this.isDragging) return
    this.isDragging = false
    this.dragLayerId = null
    this.app.stage.off('pointermove')
    this.app.stage.off('pointerup')
    this.app.stage.off('pointerupoutside')
    void layerId // used by caller
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
