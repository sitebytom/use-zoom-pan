import React from 'react'
import { Section, Table } from '../shared'

const ApiReference = () => (
  <>
    <Section title="Component Props" id="api-component">
      <Table 
        headers={['Prop', 'Type', 'Default', 'Description']}
        rows={[
          ['children', 'ReactNode', 'Required', 'The content to make zoomable.'],
          ['enableZoom', 'boolean', 'true', 'Enable/disable zoom functionality.'],
          ['onNext / onPrev', '() => void', '-', 'Callbacks for swipe-based navigation.'],
          ['options', 'ZoomPanOptions', '-', 'Configuration overrides (see Options below).'],
          ['className', 'string', '-', 'Additional CSS class for the container.'],
          ['style', 'CSSProperties', '-', 'Inline styles for the container.'],
          ['contentClassName', 'string', '-', 'CSS class for the inner content wrapper.'],
          ['contentStyle', 'CSSProperties', '-', 'Inline styles for the inner content wrapper.'],
        ]}
      />
    </Section>

    <Section title="Configuration Options" id="api-options">
      <p>Pass these into the <code>options</code> prop or hook argument to tune the interaction physics.</p>
      <Table 
        headers={['Option', 'Type', 'Default', 'Description']}
        rows={[
          ['minScale', 'number', '1', 'Minimum zoom level.'],
          ['maxScale', 'number', '6', 'Maximum zoom level.'],
          ['zoomSensitivity', 'number', '0.002', 'Scaling multiplier for scroll wheel.'],
          ['clickZoomScale', 'number', '2.5', 'Snap-to scale on double click/tap.'],
           ['boundsBuffer', 'number', '80', 'Extra panning room beyond content edges.'],
           ['initialScale', 'number', '-', 'Initial zoom level.'],
           ['initialPosition', 'Position', '-', 'Initial x/y coordinates.'],
           ['dragThresholdMouse', 'number', '5', 'Pixels to move before drag starts (mouse).'],
           ['dragThresholdTouch', 'number', '10', 'Pixels to move before drag starts (touch).'],
           ['swipeThreshold', 'number', '50', 'Pixels to move before swipe navigation triggers.'],
           ['manageCursor', 'boolean', 'true', 'Automatically handle zoom-in/grab cursor states.'],
           ['enableSwipe', 'boolean', 'true', 'Enable/disable swipe gestures for navigation.'],
         ]}
      />
    </Section>

    <Section title="Hook Return Value" id="api-return">
      <p>The <code>useZoomPan</code> hook returns an object containing the current state and necessary event handlers.</p>
      <Table 
        headers={['Value', 'Type', 'Description']}
        rows={[
          ['scale', 'number', 'Current zoom level (1-6 by default).'],
          ['position', '{ x, y }', 'Current pan coordinates.'],
          ['isDragging', 'boolean', 'True when the user is actively panning.'],
          ['reset', '() => void', 'Resets zoom and pan to defaults.'],
          ['zoomTo', '(x, y, scale) => void', 'Imperative zoom to specific coordinates and scale.'],
          ['contentProps', 'object', 'Event handlers to spread on the zoomable content.'],
          ['containerProps', 'object', 'Event handlers to spread on the container element.'],
        ]}
      />
    </Section>
  </>
)

export default ApiReference
