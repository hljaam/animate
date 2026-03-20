import React from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { getInterpolatedProps, hasKeyframeAt } from '../../pixi/interpolation'
import { DEFAULT_LAYER_PROPS } from '../../types/project'
import type { TrackProperty } from '../../types/project'
import KeyframeDiamond from './KeyframeDiamond'
import { AddLayerCommand } from '../../store/commands/AddLayerCommand'
import { createTextLayer, createImageLayer } from '../../utils/layerFactory'

const PROP_LABELS: Record<TrackProperty, string> = {
  x: 'X',
  y: 'Y',
  scaleX: 'Scale X',
  scaleY: 'Scale Y',
  rotation: 'Rotation',
  opacity: 'Opacity'
}

const TRANSFORM_PROPS: TrackProperty[] = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity']

interface LayerTabProps {
  onSwitchTab?: () => void
}

export default function LayerTab({ onSwitchTab }: LayerTabProps): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const history = useProjectStore((s) => s.history)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const currentFrame = useEditorStore((s) => s.currentFrame)
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId)

  if (!project) return <div style={{ padding: 12, color: 'var(--text-muted)' }}>No project</div>

  const layer = project.layers.find((l) => l.id === selectedLayerId)

  function handleAddTextLayer(): void {
    if (!project) return
    const layer = createTextLayer(project)
    history.push(new AddLayerCommand(layer))
    setSelectedLayerId(layer.id)
  }

  async function handleImport(): Promise<void> {
    if (!project) return
    const results = await window.electronAPI.importAsset(project.id)
    if (!results) return

    const state = useProjectStore.getState()

    for (const assetData of results) {
      const asset = {
        id: assetData.id,
        type: 'image' as const,
        name: assetData.name,
        localBundlePath: assetData.localBundlePath,
        width: assetData.width,
        height: assetData.height
      }
      state.addAsset(asset)
      const layer = createImageLayer(asset, project)
      state.history.push(new AddLayerCommand(layer))
      useEditorStore.getState().setSelectedLayerId(layer.id)
    }
  }

  if (!layer) {
    return (
      <div style={styles.noSelection}>
        <div style={styles.noSelectionHint}>
          Select a layer on the stage or timeline to edit its properties.
        </div>
        <div style={styles.noSelectionActions}>
          <button onClick={handleImport} disabled={!project} style={{ width: '100%' }}>
            Import Image
          </button>
          <button onClick={handleAddTextLayer} disabled={!project} style={{ width: '100%' }}>
            + Add Text Layer
          </button>
          <button onClick={() => onSwitchTab?.()} disabled={!project} style={{ width: '100%' }}>
            Set Background...
          </button>
        </div>
      </div>
    )
  }

  const props = getInterpolatedProps(layer.tracks, currentFrame, { ...DEFAULT_LAYER_PROPS })

  function handlePropChange(property: TrackProperty, value: number): void {
    if (!layer) return
    useProjectStore.getState().setKeyframeDirect(layer.id, property, currentFrame, value, 'linear')
  }

  function handleVisibleToggle(): void {
    useProjectStore.getState().updateLayer(layer!.id, { visible: !layer!.visible })
  }

  function handleLockedToggle(): void {
    useProjectStore.getState().updateLayer(layer!.id, { visible: layer!.visible, locked: !layer!.locked })
  }

  function formatValue(prop: TrackProperty, value: number): string {
    if (prop === 'rotation') return (value * (180 / Math.PI)).toFixed(1)
    if (prop === 'opacity') return value.toFixed(2)
    if (prop === 'scaleX' || prop === 'scaleY') return value.toFixed(3)
    return Math.round(value).toString()
  }

  function parseValue(prop: TrackProperty, raw: string): number {
    const n = parseFloat(raw)
    if (isNaN(n)) return props[prop]
    if (prop === 'rotation') return n * (Math.PI / 180)
    return n
  }

  return (
    <div style={styles.container}>
      {/* Layer info */}
      <div className="field-row">
        <label>Name</label>
        <input
          type="text"
          value={layer.name}
          onChange={(e) => useProjectStore.getState().updateLayer(layer.id, { name: e.target.value })}
        />
      </div>
      <div style={styles.toggleRow}>
        <label>
          <input type="checkbox" checked={layer.visible} onChange={handleVisibleToggle} />
          {' '}Visible
        </label>
        <label>
          <input type="checkbox" checked={layer.locked} onChange={handleLockedToggle} />
          {' '}Locked
        </label>
      </div>

      <div className="divider" />

      {/* Transform properties */}
      <div style={styles.section}>Transform</div>
      {TRANSFORM_PROPS.map((prop) => {
        const hasKf = hasKeyframeAt(layer.tracks, prop, currentFrame)
        return (
          <div key={prop} className="field-row" style={{ alignItems: 'center' }}>
            <label style={{ color: hasKf ? 'var(--accent)' : undefined, width: 56 }}>
              {PROP_LABELS[prop]}
            </label>
            <input
              type="number"
              value={formatValue(prop, props[prop])}
              step={prop === 'opacity' ? 0.05 : prop.startsWith('scale') ? 0.1 : 1}
              onChange={(e) => handlePropChange(prop, parseValue(prop, e.target.value))}
              style={{ flex: 1 }}
            />
            <KeyframeDiamond
              layerId={layer.id}
              property={prop}
              currentValue={props[prop]}
              hasKeyframe={hasKf}
            />
          </div>
        )
      })}

      {/* Text-specific properties */}
      {layer.type === 'text' && layer.textData && (
        <>
          <div className="divider" />
          <div style={styles.section}>Text</div>
          <div style={{ padding: '0 0 6px' }}>
            <textarea
              value={layer.textData.text}
              onChange={(e) =>
                useProjectStore.getState().updateLayer(layer.id, {
                  textData: { ...layer.textData!, text: e.target.value }
                })
              }
              rows={3}
            />
          </div>
          <div className="field-row">
            <label>Font</label>
            <input
              type="text"
              value={layer.textData.font}
              onChange={(e) =>
                useProjectStore.getState().updateLayer(layer.id, {
                  textData: { ...layer.textData!, font: e.target.value }
                })
              }
            />
          </div>
          <div className="field-row">
            <label>Size</label>
            <input
              type="number"
              value={layer.textData.size}
              min={4}
              onChange={(e) =>
                useProjectStore.getState().updateLayer(layer.id, {
                  textData: { ...layer.textData!, size: parseInt(e.target.value) || layer.textData!.size }
                })
              }
            />
          </div>
          <div className="field-row">
            <label>Color</label>
            <input
              type="color"
              value={layer.textData.color}
              onChange={(e) =>
                useProjectStore.getState().updateLayer(layer.id, {
                  textData: { ...layer.textData!, color: e.target.value }
                })
              }
              style={{ width: 40 }}
            />
            <input
              type="text"
              value={layer.textData.color}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                  useProjectStore.getState().updateLayer(layer.id, {
                    textData: { ...layer.textData!, color: e.target.value }
                  })
                }
              }}
              style={{ flex: 1 }}
            />
          </div>
        </>
      )}

      {/* Frame range */}
      <div className="divider" />
      <div style={styles.section}>Timing</div>
      <div className="field-row">
        <label>Start</label>
        <input
          type="number"
          value={layer.startFrame}
          min={0}
          onChange={(e) =>
            useProjectStore.getState().updateLayer(layer.id, {
              startFrame: parseInt(e.target.value) || 0
            })
          }
        />
      </div>
      <div className="field-row">
        <label>End</label>
        <input
          type="number"
          value={layer.endFrame}
          min={0}
          onChange={(e) =>
            useProjectStore.getState().updateLayer(layer.id, {
              endFrame: parseInt(e.target.value) || 0
            })
          }
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflowY: 'auto',
    flex: 1
  },
  section: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 2
  },
  toggleRow: {
    display: 'flex',
    gap: 16,
    padding: '4px 0'
  },
  noSelection: {
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  noSelectionHint: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5
  },
  noSelectionActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  }
}
