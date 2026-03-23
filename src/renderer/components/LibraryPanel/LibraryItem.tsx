import React from 'react'
import type { Asset, SymbolDef, ShapeObjectDef } from '../../types/project'

interface ImageItemProps {
  kind: 'image'
  asset: Asset
  onClick: () => void
}

interface SymbolItemProps {
  kind: 'symbol'
  symbol: SymbolDef
  onClick: () => void
}

interface ShapeObjectItemProps {
  kind: 'shapeObject'
  shapeObject: ShapeObjectDef
  onClick: () => void
  onDoubleClick?: () => void
  selected?: boolean
}

type Props = ImageItemProps | SymbolItemProps | ShapeObjectItemProps

export default function LibraryItem(props: Props): React.ReactElement {
  if (props.kind === 'image') {
    const { asset, onClick } = props
    const imgSrc = `file://${asset.localBundlePath.replace(/\\/g, '/')}`
    return (
      <div style={styles.imageCard} title={asset.name} onClick={onClick}>
        <img src={imgSrc} alt={asset.name} style={styles.imgThumb} draggable={false} />
        <span style={styles.imageName}>{asset.name}</span>
      </div>
    )
  }

  if (props.kind === 'shapeObject') {
    const { shapeObject, onClick, onDoubleClick, selected } = props
    const cardStyle = selected
      ? { ...styles.listCard, borderColor: '#e89b4e', background: 'rgba(232, 155, 78, 0.15)' }
      : styles.listCard
    return (
      <div style={cardStyle} title={shapeObject.name} onClick={onClick} onDoubleClick={onDoubleClick}>
        <div style={styles.shapeObjectIcon}>{'\u25C7'}</div>
        <div style={styles.listInfo}>
          <span style={styles.listName}>{shapeObject.name}</span>
          <span style={styles.listMeta}>
            {shapeObject.layers?.length ?? 0} {shapeObject.layers?.length === 1 ? 'Layer' : 'Layers'}
            {shapeObject.durationFrames ? ` \u00B7 ${shapeObject.durationFrames}f` : ''}
          </span>
        </div>
      </div>
    )
  }

  const { symbol, onClick } = props
  return (
    <div style={styles.listCard} title={symbol.name} onClick={onClick}>
      <div style={styles.symbolIcon}>{'\u229E'}</div>
      <div style={styles.listInfo}>
        <span style={styles.listName}>{symbol.name}</span>
        <span style={styles.listMeta}>{symbol.durationFrames}f</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  imageCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    cursor: 'pointer',
    overflow: 'hidden'
  },
  imgThumb: {
    width: '100%',
    height: 64,
    objectFit: 'cover',
    display: 'block',
    background: '#111'
  },
  imageName: {
    fontSize: 10,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    padding: '0 6px 6px'
  },
  listCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    cursor: 'pointer'
  },
  symbolIcon: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    color: 'var(--accent)',
    background: 'var(--accent-dim)',
    borderRadius: 6,
    flexShrink: 0
  },
  shapeObjectIcon: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    color: '#e89b4e',
    background: 'rgba(232, 155, 78, 0.1)',
    borderRadius: 6,
    flexShrink: 0
  },
  listInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflow: 'hidden',
    flex: 1
  },
  listName: {
    fontSize: 12,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  listMeta: {
    fontSize: 10,
    color: 'var(--text-muted)'
  }
}
