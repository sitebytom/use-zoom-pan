import React, { useRef } from 'react'
import { useZoomPan } from '../../../src'
import { ControlButton } from '../shared'

const SimpleImageExample = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scale, position, contentProps, reset } = useZoomPan({
    containerRef,
    enableZoom: true,
  })

  return (
    <div 
      ref={containerRef} 
      className="viewport-container" 
    >
      <img
        {...contentProps}
        src={`${import.meta.env.BASE_URL}assets/image-1.webp`}
        alt="Photography"
        draggable={false}
        className="viewport-image"
        style={{ 
          ...contentProps.style,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        }}
      />
      <div className="viewport-controls">
        <ControlButton onClick={reset} title="Reset View">↺</ControlButton>
      </div>

      <div className="selected-badge" style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-dim)',
        fontSize: '10px',
        fontWeight: 600,
        padding: '6px 10px',
        fontFamily: 'var(--font-mono)'
      }}>
        ASSET_01 // SCALE: {scale.toFixed(2)}x
      </div>
    </div>
  )
}

export default SimpleImageExample
