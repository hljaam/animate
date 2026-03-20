import * as PIXI from 'pixi.js'
import type { Project, Layer, Asset } from '../types/project'
import { DEFAULT_LAYER_PROPS } from '../types/project'
import type { InterpolatedProps } from './interpolation'
import { getInterpolatedProps } from './interpolation'

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

      if (layer.type === 'image' && layer.assetId) {
        const asset = project.assets.find((a) => a.id === layer.assetId)
        if (asset) this.renderImageLayer(layer, asset, props)
      } else if (layer.type === 'text' && layer.textData) {
        this.renderTextLayer(layer, props)
      }
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
