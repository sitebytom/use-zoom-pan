import React from 'react'
import { Section } from '../shared'

const Interactions = () => (
  <Section title="Gesture Mapping" id="gestures">
    <p>useZoomPan provides a consistent interaction model across desktop and mobile devices.</p>
    <div className="docs-gesture-grid">
      <div className="docs-info-card">
        <h4 className="docs-subtitle">Mouse</h4>
        <ul className="docs-list">
          <li><strong>Scroll Wheel</strong>: Zoom in/out at cursor</li>
          <li><strong>Left Click</strong>: Toggle zoom (1x ⟷ 2.5x)</li>
          <li><strong>Drag</strong>: Pan when zoomed in</li>
        </ul>
      </div>
      <div className="docs-info-card">
        <h4 className="docs-subtitle">Touch</h4>
        <ul className="docs-list">
          <li><strong>Pinch</strong>: Smooth scale at center</li>
          <li><strong>Double Tap</strong>: Toggle zoom level</li>
          <li><strong>Swipe</strong>: Navigation (if handlers provided)</li>
        </ul>
      </div>
    </div>
  </Section>
)

export default Interactions
