import React from 'react'
import { Section } from '../shared'

const Performance = () => (
  <Section title="Performance Tuning" id="performance">
    <p>The hook is designed to be <strong>highly optimized</strong> for smooth interactions on high-resolution displays and mobile devices. To maintain responsiveness without taxing the main thread, follow these best practices:</p>
    <ul className="docs-list docs-margin-top">
      <li><strong>will-change</strong>: Apply <code>will-change: transform</code> to your content element to promote it to its own GPU layer.</li>
      <li><strong>Avoid Transitions</strong>: Do not use CSS transitions for the transform property while the user is actively dragging; the hook handles position updates via JS for maximum responsiveness.</li>
      <li><strong>Touch Action</strong>: Add <code>touch-action: none</code> to your viewport to prevent browser-native scrolling while interacting with the component.</li>
      <li><strong>Optimized state updates</strong>: <code>useZoomPan</code> minimizes React work during interactions by tracking gesture state in refs and only committing state when visual output changes.</li>
    </ul>
  </Section>
)

export default Performance
