import React from 'react'
import type { Asset, SymbolDef } from '../../types/project'

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

type Props = ImageItemProps | SymbolItemProps

export default function LibraryItem(props: Props): React.ReactElement {
  if (props.kind === 'image') {
    const { asset, onClick } = props
    const imgSrc = `file://${asset.localBundlePath.replace(/\\/g, '/')}`
    return (
      <div style={styles.card} title={asset.name} onClick={onClick}>
        <img src={imgSrc} alt={asset.name} style={styles.img} draggable={false} />
        <span style={styles.name}>{asset.name}</span>
        <span style={styles.badge}>IMG</span>
      </div>
    )
  }

  const { symbol, onClick } = props
  return (
    <div style={styles.card} title={symbol.name} onClick={onClick}>
      <div style={styles.symbolIcon}>{'\u229E'}</div>
      <span style={styles.name}>{symbol.name}</span>
      <span style={styles.badge}>{symbol.durationFrames}f</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 6px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    cursor: 'pointer'
  },
  img: {
    width: 36,
    height: 36,
    objectFit: 'cover',
    borderRadius: 3,
    flexShrink: 0,
    background: '#111'
  },
  symbolIcon: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: 'var(--accent)',
    background: 'rgba(74, 158, 255, 0.1)',
    borderRadius: 3,
    flexShrink: 0
  },
  name: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1
  },
  badge: {
    fontSize: 9,
    color: 'var(--text-muted)',
    background: 'var(--bg-primary)',
    padding: '1px 4px',
    borderRadius: 3,
    flexShrink: 0
  }
}
