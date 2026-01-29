import React from 'react'
import { Section, CodeBlock, PackageManagerTabs } from '../shared'

const GettingStarted = () => (
  <Section title="Quick Start" id="getting-started">
    <p>A <strong>zero-dependency</strong>, ultra-lightweight React hook and component for implementing smooth, high-performance zoom and pan interactions.</p>
    <p className="docs-margin-top">Ideal for image viewers, galleries, maps, diagrams, and custom interactive canvases where you want full control without heavy dependencies.</p>
    
    <h3 className="docs-subtitle">Installation</h3>
    <PackageManagerTabs />

    <h3 className="docs-subtitle">Component Approach</h3>
    <p>Wraps any content and handles the standard zoom/pan logic automatically.</p>
    <CodeBlock code={`import { ZoomPan } from '@sitebytom/use-zoom-pan'

const MyViewer = () => (
  <div style={{ width: '100%', height: '500px' }}>
    <ZoomPan>
      <img src="/my-image.jpg" alt="Zoomable" />
    </ZoomPan>
  </div>
)`} />

    <h3 className="docs-subtitle">Hook Approach</h3>
    <p>For custom UI layouts where you need access to the raw <code>scale</code> and <code>position</code> state.</p>
    <CodeBlock code={`import { useRef } from 'react'
import { useZoomPan } from '@sitebytom/use-zoom-pan'

const MyCustomViewer = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scale, position, contentProps, containerProps } = useZoomPan({ containerRef })

  return (
    <div 
      ref={containerRef} 
      {...containerProps}
      style={{ width: '100%', height: '500px', overflow: 'hidden' }}
    >
      <img 
        {...contentProps}
        src="/image.jpg" 
        style={{ transform: \`translate(\${position.x}px, \${position.y}px) scale(\${scale})\` }} 
      />
    </div>
  )
}`} />

    <div className="docs-note docs-margin-top">
      <strong>Controlled vs. Uncontrolled</strong>: The hook manages zoom and pan state internally but exposes <code>scale</code> and <code>position</code> for read-only inspection or custom UI overlays.
    </div>
  </Section>
)

export default GettingStarted
