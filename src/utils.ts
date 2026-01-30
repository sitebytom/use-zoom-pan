import { Position, Bounds } from './types'

/**
 * Computes the pan boundaries based on the current scale and container/element dimensions.
 * Uses a 'top-left' origin (0,0) coordinate system.
 * Returns min/max translation values so content never shows too much empty space
 * (with buffer when content fits, full edge clamping when zoomed in).
 */
export const calculateBounds = (
    targetScale: number,
    container: HTMLElement | null,
    element: HTMLElement | null,
    boundsBuffer: number
): Bounds => {
    if (!container || !element) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }

    const cw = container.clientWidth
    const ch = container.clientHeight
    const ew = element.offsetWidth || cw
    const eh = element.offsetHeight || ch

    const sw = ew * targetScale
    const sh = eh * targetScale

    // When scaled content fits inside container → allow small buffer movement around the center
    const minX = sw <= cw ? (cw - sw) / 2 - boundsBuffer : cw - sw - boundsBuffer
    const maxX = sw <= cw ? (cw - sw) / 2 + boundsBuffer : boundsBuffer

    const minY = sh <= ch ? (ch - sh) / 2 - boundsBuffer : ch - sh - boundsBuffer
    const maxY = sh <= ch ? (ch - sh) / 2 + boundsBuffer : boundsBuffer

    return { minX, maxX, minY, maxY }
}

/** Ensures the given position stays within the calculated pan boundaries */
export const clampPosition = (
    pos: Position,
    targetScale: number,
    container: HTMLElement | null,
    element: HTMLElement | null,
    boundsBuffer: number
): Position => {
    const b = calculateBounds(targetScale, container, element, boundsBuffer)
    return {
        x: Math.max(b.minX, Math.min(b.maxX, pos.x)),
        y: Math.max(b.minY, Math.min(b.maxY, pos.y)),
    }
}

/** 
 * Normalizes wheel delta across browsers and input devices.
 * Trackpads send small deltas, physical wheels send large ones mapped by deltaMode.
 */
export const normalizeWheelDelta = (e: WheelEvent, sensitivity: number): number => {
    // deltaMode 1 is 'lines' (physical wheels), 0 is 'pixels' (trackpads)
    const factor = e.deltaMode === 1 ? 20 : 1 
    return -e.deltaY * factor * sensitivity
}
