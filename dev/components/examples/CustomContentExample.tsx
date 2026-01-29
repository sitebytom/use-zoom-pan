import React, { useRef } from 'react'
import { useZoomPan } from '../../../src'
import { ControlButton } from '../shared'

const CustomContentExample = () => {
    const containerRef = useRef<HTMLDivElement>(null)
    const { scale, position, contentProps, reset } = useZoomPan({
        containerRef,
        enableZoom: true,
        options: { minScale: 0.4, maxScale: 5 }
    })

    return (
        <div 
            ref={containerRef} 
            className="viewport-container" 
            style={{ 
                background: '#0a0a0b',
                width: '100%',
                height: '100%'
            }}
        >
            <div className="selected-badge">
                SCALE: {scale.toFixed(2)}x<br/>
                X_POS: {position.x.toFixed(0)}px<br/>
                Y_POS: {position.y.toFixed(0)}px
            </div>
            <div 
                {...contentProps}
                className="viewport-canvas"
                style={{
                    ...contentProps.style,
                    width: '600px',
                    height: '400px',
                    background: 'var(--surface-1)',
                    padding: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
                }}
            >
                <div style={{ width: '40px', height: '40px', background: 'var(--text)', borderRadius: 'var(--radius-sm)', marginBottom: '20px' }}></div>
                <h3 style={{ fontSize: '2rem', margin: '0 0 10px 0', color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.04em' }}>Technical Canvas</h3>
                <p style={{ color: 'var(--text-dim)', lineHeight: 1.6, fontSize: '15px' }}>This is a fully zoomed-capable DIV element containing text, sub-elements, and shadows. Perfection for map-like interfaces or large diagrams.</p>
            </div>
            <div className="viewport-controls">
                <ControlButton onClick={reset} title="Reset View">↺</ControlButton>
            </div>
        </div>
    )
}

export default CustomContentExample
