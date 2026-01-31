import React, { useRef, useState } from 'react'
import { useZoomPan } from '../../../src'
import { ControlButton } from '../shared'

const InteractivePinsExample = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scale, position, contentProps, reset, zoomTo } = useZoomPan({
    containerRef,
    enableZoom: true,
    options: {
      minScale: 1.15,
      initialScale: 1.15,
    }
  })

  const [activePin, setActivePin] = useState<{ id: number, label: string, x: number, y: number } | null>(null)

  /* Defines pins in coordinate space relative to the center (0,0) of the image */
  const pins = [
    { id: 1, x: 0, y: 50, label: 'Reindeer' },      // 50px down from center
    { id: 2, x: 300, y: 150, label: 'Lake' },       // Bottom right
    { id: 3, x: -300, y: -90, label: 'Marshes' }    // Top left
  ]

  return (
    <div 
      ref={containerRef} 
      className="viewport-container"
    >
      <div 
          {...contentProps}
          className="viewport-canvas"
          style={{ 
              ...contentProps.style,
              width: '800px',
              height: '500px',
              // Center-origin positioning:
              // Translate -50% -50% centers the element itself
              // Then we add the position offset (x,y)
              transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
              background: 'var(--bg)',
          }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/image-3.webp`}
          draggable={false}
          className="viewport-image"
          style={{ objectFit: 'cover' }}
        />
        <div className="pin-container">
          {pins.map(pin => (
            <div 
              key={pin.id} 
              className={`pin ${activePin?.id === pin.id ? 'selected' : ''}`}
              style={{
                left: '50%', // Start from center
                top: '50%',
                // Move by pin coordinate, and adjust for pin size/anchor
                transform: `translate(${pin.x}px, ${pin.y}px) translate(-50%, -100%) scale(${1/scale})`,
                transformOrigin: 'bottom center',
              }}
              onClick={(e) => {
                e.stopPropagation();
                zoomTo(pin.x, pin.y);
                setActivePin(pin);
              }}
            >
              <div className="pin-label" style={{ opacity: scale > 0.8 ? 1 : 0 }}>
                {pin.label}
              </div>
              <div className="pin-marker" />
            </div>
          ))}
        </div>
      </div>

      <div className="selected-badge" style={{ 
        opacity: activePin ? 1 : 0,
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text)',
        fontSize: '12px',
        fontWeight: 600,
        padding: '6px 12px',
        fontFamily: 'var(--font-mono)'
      }}>
         {activePin ? `PIN_ID: ${activePin.id} // ${activePin.label.toUpperCase()}` : 'SELECT_PIN'}
      </div>

      <div className="viewport-controls">
         <ControlButton onClick={() => { reset(); setActivePin(null); }} title="Reset View">↺</ControlButton>
      </div>
    </div>
  )
}

export default InteractivePinsExample
