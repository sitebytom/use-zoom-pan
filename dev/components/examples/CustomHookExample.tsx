import React, { useRef, useState } from 'react'
import { useZoomPan } from '../../../src'
import { ControlButton } from '../shared'

import { DEFAULT_PLAYGROUND_OPTIONS } from './constants'

const CustomHookViewport = ({ options, onReset }: { options: typeof DEFAULT_PLAYGROUND_OPTIONS, onReset: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { scale, position, contentProps, reset } = useZoomPan<HTMLDivElement>({
    containerRef,
    enableZoom: true,
    options
  })

  const handleReset = () => {
    reset()
    onReset()
  }

  return (
    <div 
      ref={containerRef}
      className="viewport-container aspect-16-10"
    >
      <img
        {...(contentProps as any)}
        src={`${import.meta.env.BASE_URL}assets/image-2.webp`}
        alt="Photography"
        draggable={false}
        className="viewport-image"
        style={{
          ...contentProps.style,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      
      <div className="viewport-controls">
         <ControlButton onClick={handleReset} title="Reset View & Options">↺</ControlButton>
      </div>

      <div className="selected-badge" style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text)',
        fontSize: '11px',
        fontWeight: 600,
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)'
      }}>
        LVL_SCALE: {scale.toFixed(2)}x<br/>
        X_COORD: {position.x.toFixed(0)}px<br/>
        Y_COORD: {position.y.toFixed(0)}px
      </div>
    </div>
  )
}

const CustomHookControls = ({ options, setOptions }: { options: typeof DEFAULT_PLAYGROUND_OPTIONS, setOptions: React.Dispatch<React.SetStateAction<typeof DEFAULT_PLAYGROUND_OPTIONS>> }) => {
  return (
    <div className="playground-panel">
      <div className="playground-group">
        <label className="playground-label">
          Max Scale <span className="playground-value">{options.maxScale}x</span>
        </label>
        <input 
          type="range" min="1" max="10" step="0.5" 
          value={options.maxScale} 
          onChange={(e) => setOptions(o => ({ ...o, maxScale: Number(e.target.value) }))}
          className="playground-range"
        />
      </div>
      <div className="playground-group">
        <label className="playground-label">
          Click Zoom <span className="playground-value">{options.clickZoomScale}x</span>
        </label>
        <input 
          type="range" min="1" max="5" step="0.1" 
          value={options.clickZoomScale} 
          onChange={(e) => setOptions(o => ({ ...o, clickZoomScale: Number(e.target.value) }))}
          className="playground-range"
        />
      </div>
      <div className="playground-group">
        <label className="playground-label">
          Sensitivity <span className="playground-value">{options.zoomSensitivity.toFixed(3)}</span>
        </label>
        <input 
          type="range" min="0.0005" max="0.01" step="0.0005" 
          value={options.zoomSensitivity} 
          onChange={(e) => setOptions(o => ({ ...o, zoomSensitivity: Number(e.target.value) }))}
          className="playground-range"
        />
      </div>
      <div className="playground-group">
        <label className="playground-label">
          Min Scale <span className="playground-value">{options.minScale}x</span>
        </label>
        <input 
          type="range" min="0.1" max="1" step="0.1" 
          value={options.minScale} 
          onChange={(e) => setOptions(o => ({ ...o, minScale: Number(e.target.value) }))}
          className="playground-range"
        />
      </div>
    </div>
  )
}

const CustomHookExample = ({ mode, options, setOptions, onReset }: { 
  mode: 'viewport' | 'controls', 
  options: typeof DEFAULT_PLAYGROUND_OPTIONS, 
  setOptions: React.Dispatch<React.SetStateAction<typeof DEFAULT_PLAYGROUND_OPTIONS>>,
  onReset: () => void
}) => {
  if (mode === 'viewport') return <CustomHookViewport options={options} onReset={onReset} />
  return <CustomHookControls options={options} setOptions={setOptions} />
}

export default CustomHookExample
