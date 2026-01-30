import { ZoomPanOptions, Position } from './types'

// Default configuration
export const DEFAULT_OPTIONS: Required<Omit<ZoomPanOptions, 'initialScale' | 'initialPosition'>> & { initialScale?: number, initialPosition?: Position } = {
    minScale: 1,
    maxScale: 6,
    zoomSensitivity: 0.002,
    clickZoomScale: 2.5,
    dragThresholdMouse: 5,
    dragThresholdTouch: 10,
    swipeThreshold: 50,
    boundsBuffer: 80,
    manageCursor: true,
    enableSwipe: true,
    initialScale: undefined,
    initialPosition: undefined,
}

export const TRANSITION_DURATION = 400
export const TRANSITION_CURVE = 'cubic-bezier(0.2, 0, 0, 1)'
