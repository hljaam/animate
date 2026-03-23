import React from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { getInterpolatedProps, hasKeyframeAt } from '../../pixi/interpolation'
import { DEFAULT_LAYER_PROPS, DEFAULT_EASING } from '../../types/project'
import type { TrackProperty } from '../../types/project'
import KeyframeDiamond from './KeyframeDiamond'
import { createTextLayer, createImageLayer, createRectangleLayer } from '../../utils/layerFactory'

const TRANSFORM_PROPS: TrackProperty[] = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity']

interface LayerTabProps {
  onSwitchTab?: () => void
}

export default function LayerTab({ onSwitchTab }: LayerTabProps): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const currentFrame = useEditorStore((s) => s.currentFrame)
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId)

  if (!project) return <div style={{ padding: 12, color: 'var(--text-muted)' }}>No project</div>

  const layer = project.layers.find((l) => l.id === selectedLayerId)

  function handleAddTextLayer(): void {
    if (!project) return
    const layer = createTextLayer(project)
    useProjectStore.getState().applyAction(`Add layer "${layer.name}"`, (draft) => {
      draft.layers.push(layer)
      draft.layers.sort((a, b) => a.order - b.order)
    })
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
      state.applyAction(`Add layer "${layer.name}"`, (draft) => {
        draft.layers.push(layer)
        draft.layers.sort((a, b) => a.order - b.order)
      })
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
          <button
            onClick={() => {
              if (!project) return
              const layer = createRectangleLayer(project)
              useProjectStore.getState().applyAction(`Add layer "${layer.name}"`, (draft) => {
                draft.layers.push(layer)
                draft.layers.sort((a, b) => a.order - b.order)
              })
              setSelectedLayerId(layer.id)
            }}
            disabled={!project}
            style={{ width: '100%' }}
          >
            + Add Shape Layer
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
    useProjectStore.getState().mutateProject((draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      let track = draftLayer.tracks.find((t) => t.property === property)
      if (!track) {
        track = { property, keyframes: [] }
        draftLayer.tracks.push(track)
      }
      const kfIdx = track.keyframes.findIndex((kf) => kf.frame === currentFrame)
      if (kfIdx === -1) {
        track.keyframes.push({ frame: currentFrame, value, easing: DEFAULT_EASING })
        track.keyframes.sort((a, b) => a.frame - b.frame)
      } else {
        track.keyframes[kfIdx].value = value
      }
    })
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

  const opacityPct = Math.round(props.opacity * 100)

  // Get tint color from layer
  const tintColor = layer.tintColor ?? '#0E87FF'

  return (
    <div style={styles.container}>
      {/* TRANSFORM section */}
      <div style={styles.sectionHeader}>TRANSFORM</div>

      {/* Position X / Position Y */}
      <div style={styles.fieldPairRow}>
        <div style={styles.fieldPairItem}>
          <label style={styles.fieldLabel}>Position X</label>
          <div style={styles.fieldInputWrap}>
            <input
              type="number"
              value={formatValue('x', props.x)}
              onChange={(e) => handlePropChange('x', parseValue('x', e.target.value))}
              style={styles.fieldInput}
            />
            <span style={styles.fieldUnit}>px</span>
            <KeyframeDiamond layerId={layer.id} property="x" currentValue={props.x} hasKeyframe={hasKeyframeAt(layer.tracks, 'x', currentFrame)} />
          </div>
        </div>
        <div style={styles.fieldPairItem}>
          <label style={styles.fieldLabel}>Position Y</label>
          <div style={styles.fieldInputWrap}>
            <input
              type="number"
              value={formatValue('y', props.y)}
              onChange={(e) => handlePropChange('y', parseValue('y', e.target.value))}
              style={styles.fieldInput}
            />
            <span style={styles.fieldUnit}>px</span>
            <KeyframeDiamond layerId={layer.id} property="y" currentValue={props.y} hasKeyframe={hasKeyframeAt(layer.tracks, 'y', currentFrame)} />
          </div>
        </div>
      </div>

      {/* Scale / Rotation */}
      <div style={styles.fieldPairRow}>
        <div style={styles.fieldPairItem}>
          <label style={styles.fieldLabel}>Scale</label>
          <div style={styles.fieldInputWrap}>
            <input
              type="number"
              value={Math.round(props.scaleX * 100)}
              step={1}
              onChange={(e) => {
                const v = (parseFloat(e.target.value) || 100) / 100
                handlePropChange('scaleX', v)
                handlePropChange('scaleY', v)
              }}
              style={styles.fieldInput}
            />
            <span style={styles.fieldUnit}>%</span>
            <KeyframeDiamond layerId={layer.id} property="scaleX" currentValue={props.scaleX} hasKeyframe={hasKeyframeAt(layer.tracks, 'scaleX', currentFrame)} />
          </div>
        </div>
        <div style={styles.fieldPairItem}>
          <label style={styles.fieldLabel}>Rotation</label>
          <div style={styles.fieldInputWrap}>
            <input
              type="number"
              value={formatValue('rotation', props.rotation)}
              step={1}
              onChange={(e) => handlePropChange('rotation', parseValue('rotation', e.target.value))}
              style={styles.fieldInput}
            />
            <span style={styles.fieldUnit}>deg</span>
            <KeyframeDiamond layerId={layer.id} property="rotation" currentValue={props.rotation} hasKeyframe={hasKeyframeAt(layer.tracks, 'rotation', currentFrame)} />
          </div>
        </div>
      </div>

      {/* APPEARANCE section */}
      <div style={{ ...styles.sectionHeader, marginTop: 16 }}>APPEARANCE</div>

      {/* Opacity */}
      <div style={styles.opacityRow}>
        <label style={styles.fieldLabel}>Opacity</label>
        <span style={styles.opacityValue}>{opacityPct}%</span>
      </div>
      <div style={styles.sliderRow}>
        <input
          type="range"
          min={0}
          max={100}
          value={opacityPct}
          onChange={(e) => handlePropChange('opacity', parseInt(e.target.value) / 100)}
          style={styles.slider}
        />
        <KeyframeDiamond layerId={layer.id} property="opacity" currentValue={props.opacity} hasKeyframe={hasKeyframeAt(layer.tracks, 'opacity', currentFrame)} />
      </div>

      {/* Tint color */}
      <div style={styles.tintRow}>
        <input
          type="color"
          value={tintColor}
          onChange={(e) => {
            useProjectStore.getState().updateLayer(layer.id, { tintColor: e.target.value })
          }}
          style={styles.tintSwatch}
        />
        <input
          type="text"
          value={tintColor}
          onChange={(e) => {
            if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
              useProjectStore.getState().updateLayer(layer.id, { tintColor: e.target.value })
            }
          }}
          style={styles.tintHex}
        />
        <button style={styles.tintEditBtn} title="Edit color">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2l3 3-7 7H2v-3l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* EFFECTS section */}
      <div style={{ ...styles.sectionHeader, marginTop: 16 }}>
        <span>EFFECTS</span>
        <button style={styles.addEffectBtn}>+ Add Effect</button>
      </div>

      {/* Show filters if any */}
      {layer.filters && layer.filters.length > 0 && (
        <div style={styles.effectsList}>
          {layer.filters.map((f, i) => (
            <div key={i} style={styles.effectItem}>
              <span style={styles.effectName}>
                {f.type === 'blur' ? 'Gaussian Blur' : f.type === 'dropShadow' ? 'Drop Shadow' : 'Glow'}
              </span>
              <span style={styles.effectValue}>
                {f.type === 'blur' && `${f.strength ?? 4} px`}
                {f.type === 'dropShadow' && `${f.distance ?? 4} px`}
                {f.type === 'glow' && `${f.distance ?? 4} px`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Text-specific properties */}
      {layer.type === 'text' && layer.textData && (
        <>
          <div style={{ ...styles.sectionHeader, marginTop: 16 }}>TEXT</div>
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

      {/* Shape-specific properties */}
      {layer.type === 'shape' && layer.shapeData && layer.shapeData.paths.length > 0 && (
        <>
          <div style={{ ...styles.sectionHeader, marginTop: 16 }}>SHAPE</div>
          <div className="field-row">
            <label>Fill</label>
            <input
              type="color"
              value={layer.shapeData.paths[0].fillColor || '#000000'}
              onChange={(e) => {
                const newPaths = layer.shapeData!.paths.map((p) =>
                  p.fillColor !== undefined ? { ...p, fillColor: e.target.value } : p
                )
                useProjectStore.getState().updateLayer(layer.id, {
                  shapeData: { ...layer.shapeData!, paths: newPaths }
                })
              }}
              style={{ width: 40 }}
            />
            <input
              type="text"
              value={layer.shapeData.paths[0].fillColor || ''}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                  const newPaths = layer.shapeData!.paths.map((p) =>
                    p.fillColor !== undefined ? { ...p, fillColor: e.target.value } : p
                  )
                  useProjectStore.getState().updateLayer(layer.id, {
                    shapeData: { ...layer.shapeData!, paths: newPaths }
                  })
                }
              }}
              style={{ flex: 1 }}
            />
          </div>
          <div className="field-row">
            <label>Stroke</label>
            <input
              type="color"
              value={layer.shapeData.paths[0].strokeColor || '#000000'}
              onChange={(e) => {
                const newPaths = layer.shapeData!.paths.map((p) => ({
                  ...p,
                  strokeColor: e.target.value
                }))
                useProjectStore.getState().updateLayer(layer.id, {
                  shapeData: { ...layer.shapeData!, paths: newPaths }
                })
              }}
              style={{ width: 40 }}
            />
            <input
              type="text"
              value={layer.shapeData.paths[0].strokeColor || ''}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value) || e.target.value === '') {
                  const newPaths = layer.shapeData!.paths.map((p) => ({
                    ...p,
                    strokeColor: e.target.value || undefined
                  }))
                  useProjectStore.getState().updateLayer(layer.id, {
                    shapeData: { ...layer.shapeData!, paths: newPaths }
                  })
                }
              }}
              style={{ flex: 1 }}
            />
          </div>
          <div className="field-row">
            <label>Width</label>
            <input
              type="number"
              value={layer.shapeData.paths[0].strokeWidth || 0}
              min={0}
              step={1}
              onChange={(e) => {
                const w = parseFloat(e.target.value) || 0
                const newPaths = layer.shapeData!.paths.map((p) => ({
                  ...p,
                  strokeWidth: w > 0 ? w : undefined,
                  strokeColor: w > 0 ? (p.strokeColor || '#000000') : p.strokeColor
                }))
                useProjectStore.getState().updateLayer(layer.id, {
                  shapeData: { ...layer.shapeData!, paths: newPaths }
                })
              }}
            />
          </div>
        </>
      )}

      {/* Frame Label */}
      <div style={{ ...styles.sectionHeader, marginTop: 16 }}>FRAME LABEL</div>
      <div style={styles.fieldPairItem}>
        <label style={styles.fieldLabel}>Label at Frame {currentFrame}</label>
        <input
          type="text"
          value={project.frameLabels?.[currentFrame] ?? ''}
          placeholder="e.g. start, loop"
          onChange={(e) => {
            const val = e.target.value
            useProjectStore.getState().applyAction(`Set frame label at ${currentFrame}`, (draft) => {
              if (!draft.frameLabels) draft.frameLabels = {}
              if (val.trim()) {
                draft.frameLabels[currentFrame] = val.trim()
              } else {
                delete draft.frameLabels[currentFrame]
              }
            })
          }}
          style={styles.fieldInput}
        />
      </div>

      {/* Timing */}
      <div style={{ ...styles.sectionHeader, marginTop: 16 }}>TIMING</div>
      <div style={styles.fieldPairRow}>
        <div style={styles.fieldPairItem}>
          <label style={styles.fieldLabel}>Start</label>
          <input
            type="number"
            value={layer.startFrame}
            min={0}
            onChange={(e) =>
              useProjectStore.getState().updateLayer(layer.id, {
                startFrame: parseInt(e.target.value) || 0
              })
            }
            style={styles.fieldInput}
          />
        </div>
        <div style={styles.fieldPairItem}>
          <label style={styles.fieldLabel}>End</label>
          <input
            type="number"
            value={layer.endFrame}
            min={0}
            onChange={(e) =>
              useProjectStore.getState().updateLayer(layer.id, {
                endFrame: parseInt(e.target.value) || 0
              })
            }
            style={styles.fieldInput}
          />
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflowY: 'auto',
    flex: 1
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  fieldPairRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 4
  },
  fieldPairItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  fieldLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    textTransform: 'none',
    letterSpacing: 0
  },
  fieldInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4
  },
  fieldInput: {
    flex: 1,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '6px 8px',
    color: 'var(--text-primary)',
    fontSize: 12
  },
  fieldUnit: {
    fontSize: 10,
    color: 'var(--text-muted)',
    flexShrink: 0
  },
  opacityRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  opacityValue: {
    fontSize: 12,
    color: 'var(--text-primary)',
    fontWeight: 500
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  slider: {
    flex: 1,
    height: 4,
    appearance: 'auto',
    accentColor: 'var(--accent)',
    cursor: 'pointer'
  },
  tintRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  tintSwatch: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0
  },
  tintHex: {
    flex: 1,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '6px 8px',
    color: 'var(--text-primary)',
    fontSize: 12,
    textTransform: 'uppercase'
  },
  tintEditBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 0,
    minHeight: 'auto',
    minWidth: 'auto'
  },
  addEffectBtn: {
    fontSize: 11,
    color: 'var(--accent)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    minHeight: 'auto',
    minWidth: 'auto',
    fontWeight: 500
  },
  effectsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  effectItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    background: 'var(--bg-tertiary)',
    borderRadius: 4,
    border: '1px solid var(--border)'
  },
  effectName: {
    fontSize: 12,
    color: 'var(--text-primary)'
  },
  effectValue: {
    fontSize: 11,
    color: 'var(--text-secondary)'
  },
  noSelection: {
    padding: '16px 16px',
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
