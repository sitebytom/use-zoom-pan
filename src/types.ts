import React from 'react'
/** Represents a 2D coordinate or translation offset */
export interface Position {
    x: number
    y: number
}

/** Gesture types for priority management */
export type GestureType = 'none' | 'pinch' | 'drag' | 'swipe'

export interface ZoomPanOptions {
    /** Minimum zoom scale (default: 1) */
    minScale?: number
    /** Maximum zoom scale (default: 4) */
    maxScale?: number
    /** Initial zoom scale (default: minScale) */
    initialScale?: number
    /** Initial x/y position (default: {x:0, y:0}) */
    initialPosition?: Position
    /** Mouse wheel zoom sensitivity (default: 0.002) */
    zoomSensitivity?: number
    /** Zoom level when clicking to zoom (default: 2.5) */
    clickZoomScale?: number
    /** Pixels moved before drag is detected on mouse (default: 5) */
    dragThresholdMouse?: number
    /** Pixels moved before drag is detected on touch (default: 10) */
    dragThresholdTouch?: number
    /** Pixels swiped before navigation triggers (default: 50) */
    swipeThreshold?: number
    /** Extra pan space beyond image edges in pixels (default: 80) */
    boundsBuffer?: number
    /** Whether to automatically manage cursor states (default: true) */
    manageCursor?: boolean
    /** Whether to enable swipe navigation (default: true) */
    enableSwipe?: boolean
}

/** Properties for the useZoomPan hook */
export interface ZoomPanProps {
    /** 
     * Reference to the container element that will host the zoomable content.
     */
    containerRef: React.RefObject<HTMLElement | null>
    /** Whether to enable zoom interactions (default: true) */
    enableZoom?: boolean
    /** Callback triggered on swipe-left (next) */
    onNext?: () => void
    /** Callback triggered on swipe-right (prev) */
    onPrev?: () => void
    /** Configuration options for zoom and pan behavior */
    options?: ZoomPanOptions
}

/** Internal state tracking for mouse/touch dragging */
export interface DragState {
    /** Current cumulative X position relative to start position */
    x: number
    /** Current cumulative Y position relative to start position */
    y: number
    /** Flag to prevent click events if a drag occurred */
    hasDragged: boolean
    /** Initial clientX when interaction started */
    startX: number
    /** Initial clientY when interaction started */
    startY: number
}

/** Internal state for tracking multi-touch pinch-to-zoom gestures */
export interface PinchState {
    /** Distance between two fingers when pinch started */
    startDist: number
    /** Zoom level when pinch started */
    initialScale: number
    /** Center X between two fingers when pinch started */
    startX: number
    /** Center Y between two fingers when pinch started */
    startY: number
    /** Content position when pinch started */
    startPos: Position
    /** Cached container rect for performant coordinate mapping during the gesture */
    containerRect?: DOMRect | null
}

/** Minimum and maximum allowed translation offsets for the current scale */
export interface Bounds {
    minX: number
    maxX: number
    minY: number
    maxY: number
}
