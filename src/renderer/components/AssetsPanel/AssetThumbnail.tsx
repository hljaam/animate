import React from 'react'
import type { Asset } from '../../types/project'

interface Props {
  asset: Asset
}

export default function AssetThumbnail({ asset }: Props): React.ReactElement {
  const imgSrc = `file://${asset.localBundlePath.replace(/\\/g, '/')}`

  return (
    <div
      style={styles.card}
      title={asset.name}
    >
      <img
        src={imgSrc}
        alt={asset.name}
        style={styles.img}
        draggable={false}
      />
      <span style={styles.name}>{asset.name}</span>
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
    cursor: 'default'
  },
  img: {
    width: 36,
    height: 36,
    objectFit: 'cover',
    borderRadius: 3,
    flexShrink: 0,
    background: '#111'
  },
  name: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1
  }
}
