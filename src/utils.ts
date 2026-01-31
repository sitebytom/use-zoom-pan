import { Position } from './types'

/** Minimum and maximum allowed translation offsets for the current scale */
interface Bounds {
    xLimit: number
    yLimit: number
}

/** Calculates the pan boundaries for a given scale and container/element dimensions */
export const calculateBounds = (
    targetScale: number,
    container: HTMLElement | null,
    element: HTMLElement | null,
    boundsBuffer: number
): Bounds => {
    if (!container || !element) return { xLimit: 0, yLimit: 0 }

    const cw = container.clientWidth
    const ch = container.clientHeight
    const ew = element.offsetWidth || cw
    const eh = element.offsetHeight || ch

    const sw = ew * targetScale
    const sh = eh * targetScale

    // In a flex-centered container, the limits are half the overflow
    const xLimit = Math.max(0, (sw - cw) / 2) + boundsBuffer
    const yLimit = Math.max(0, (sh - ch) / 2) + boundsBuffer

    return { xLimit, yLimit }
}

/** Ensures the given position stays within the calculated pan boundaries */
export const clampPosition = (
    pos: Position,
    targetScale: number,
    container: HTMLElement | null,
    element: HTMLElement | null,
    boundsBuffer: number
): Position => {
    const { xLimit, yLimit } = calculateBounds(targetScale, container, element, boundsBuffer)
    return {
        x: Math.max(-xLimit, Math.min(xLimit, pos.x)),
        y: Math.max(-yLimit, Math.min(yLimit, pos.y)),
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
