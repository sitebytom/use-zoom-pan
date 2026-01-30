'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Represents a 2D coordinate or translation offset */
interface Position {
    x: number
    y: number
}

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
interface ZoomPanProps {
    /** 
     * Reference to the container element that will host the zoomable content.
     * The first child of this container is assumed to be the content unless contentRef is used.
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

// Default configuration
const DEFAULT_OPTIONS: Required<Omit<ZoomPanOptions, 'initialScale' | 'initialPosition'>> & { initialScale?: number, initialPosition?: Position } = {
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

const TRANSITION_DURATION = 400
const TRANSITION_CURVE = 'cubic-bezier(0.2, 0, 0, 1)'

/** Internal state tracking for mouse/touch dragging */
interface DragState {
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
interface PinchState {
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

// Helper functions for boundary calculations
/** Minimum and maximum allowed translation offsets for the current scale */
interface Bounds {
    minX: number
    maxX: number
    minY: number
    maxY: number
}

/**
 * Computes the pan boundaries based on the current scale and container/element dimensions.
 * Uses a 'top-left' origin (0,0) coordinate system.
 * Returns min/max translation values so content never shows too much empty space
 * (with buffer when content fits, full edge clamping when zoomed in).
 */
const calculateBounds = (
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
const clampPosition = (
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
const normalizeWheelDelta = (e: WheelEvent, sensitivity: number): number => {
    // deltaMode 1 is 'lines' (physical wheels), 0 is 'pixels' (trackpads)
    const factor = e.deltaMode === 1 ? 20 : 1 
    return -e.deltaY * factor * sensitivity
}

/**
 * A highly optimized hook for zoom and pan interactions.
 * Supports mouse wheel, dragging, double-click to focal zoom, and pinch-to-zoom on touch.
 */
export const useZoomPan = ({
    containerRef,
    enableZoom = true,
    onNext,
    onPrev,
    options = {}
}: ZoomPanProps) => {
    // Memoize the merged config to ensure stability
    const config = React.useMemo(() => ({
        ...DEFAULT_OPTIONS,
        ...options
    }), [
        options.minScale,
        options.maxScale,
        options.zoomSensitivity,
        options.clickZoomScale,
        options.dragThresholdMouse,
        options.dragThresholdTouch,
        options.swipeThreshold,
        options.boundsBuffer,
        options.manageCursor,
        options.initialScale,
        options.initialPosition
    ])

    const contentRef = React.useRef<HTMLElement | null>(null)

    // Internal helper to get content element
    const getContentElement = useCallback(() => {
        return (contentRef.current || containerRef.current?.firstElementChild) as HTMLElement | null
    }, [containerRef])
    const [scale, setScale] = useState(config.initialScale ?? config.minScale)
    const [position, setPosition] = useState<Position>(config.initialPosition ?? { x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [isTransitioning, setIsTransitioning] = useState(false)

    const dragStartRef = useRef<DragState>({
        x: 0,
        y: 0,
        hasDragged: false,
        startX: 0,
        startY: 0,
    })

    const pinchRef = useRef<PinchState>({
        startDist: 0,
        initialScale: config.minScale,
        startX: 0,
        startY: 0,
        startPos: { x: 0, y: 0 },
    })

    const touchStartXRef = useRef<number>(0)
    const swipeBlockedRef = useRef<boolean>(false)
    const lastTapTimeRef = useRef<number>(0)
    
    /** Performance-critical cached bounding box of the container during gestures */
    const cachedRectRef = useRef<DOMRect | null>(null)

    // Track state for stable event listeners (non-passive wheel)
    const stateRef = useRef({ scale, position, enableZoom, isDragging, config })
    useEffect(() => {
        stateRef.current = { scale, position, enableZoom, isDragging, config }
    }, [scale, position, enableZoom, isDragging, config])

    // Cleanup on unmount and global window listeners for robustness
    useEffect(() => {
        const handleGlobalUp = () => {
            if (stateRef.current.isDragging) {
                setIsDragging(false)
            }
            // Invalidate rect cache when interaction ends
            cachedRectRef.current = null
        }

        const handleBlur = () => {
            setIsDragging(false)
            cachedRectRef.current = null
        }

        window.addEventListener('mouseup', handleGlobalUp)
        window.addEventListener('touchend', handleGlobalUp)
        window.addEventListener('touchcancel', handleGlobalUp)
        window.addEventListener('blur', handleBlur)

        return () => {
            window.removeEventListener('mouseup', handleGlobalUp)
            window.removeEventListener('touchend', handleGlobalUp)
            window.removeEventListener('touchcancel', handleGlobalUp)
            window.removeEventListener('blur', handleBlur)
            cachedRectRef.current = null
            setIsDragging(false)
            dragStartRef.current.hasDragged = false
            setIsTransitioning(false)
        }
    }, [])


    // Handle container resize and content load
    const updateBoundsAndClamp = useCallback(() => {
        const container = containerRef.current
        const content = getContentElement()
        if (!container || !content) return
            const currentPos = { x: stateRef.current.position.x, y: stateRef.current.position.y }
            const clamped = clampPosition(currentPos, stateRef.current.scale, container, content, config.boundsBuffer)
            if (clamped.x !== currentPos.x || clamped.y !== currentPos.y) {
                setPosition(clamped)
            }
    }, [containerRef, config.boundsBuffer, getContentElement])

    React.useLayoutEffect(() => {
        const container = containerRef.current
        const content = getContentElement()
        if (!container || !content) return

        // Only run if we just mounted or scale changed to initial value
        if (position.x === 0 && position.y === 0 && scale === (config.initialScale ?? config.minScale)) {
            const cw = container.clientWidth
            const ch = container.clientHeight
            const iw = content.offsetWidth || cw
            const ih = content.offsetHeight || ch

            const s = scale
            setPosition({
                x: (cw - iw * s) / 2,
                y: (ch - ih * s) / 2,
            })
        }

        const observer = new ResizeObserver(() => {
            updateBoundsAndClamp()
        })

        observer.observe(container)
        
        // Also listen for image loads in the content
        if (content instanceof HTMLImageElement && !content.complete) {
            content.addEventListener('load', updateBoundsAndClamp)
        }

        return () => {
            observer.disconnect()
            if (content instanceof HTMLImageElement) {
                content.removeEventListener('load', updateBoundsAndClamp)
            }
        }
    }, [containerRef, getContentElement, config.initialScale, config.minScale, scale, position.x, position.y, updateBoundsAndClamp])

    // Internal clamp helper that uses current config and container
    const getClampedPosition = useCallback(
        (pos: Position, targetScale: number, element: HTMLElement): Position => {
            return clampPosition(
                pos,
                targetScale,
                containerRef.current,
                element,
                config.boundsBuffer
            )
        },
        [containerRef, config.boundsBuffer],
    )

    /**
     * Internal handler for manual wheel events. 
     * Uses a non-passive listener to allow preventDefault() when zooming.
     */
    const handleWheelManual = useCallback(
        (e: WheelEvent) => {
            if (!stateRef.current.enableZoom) return
            setIsTransitioning(false) // Cancel any active transition
            e.preventDefault()

            const { scale: currentScale, position: currentPosition, config } = stateRef.current
            
            // Normalize deltaY: Trackpads often send small deltas, physical wheels send large ones.
            const delta = normalizeWheelDelta(e, config.zoomSensitivity)
            const newScale = Math.min(Math.max(config.minScale, currentScale + delta), config.maxScale)

            if (newScale === currentScale) return // No change

            const container = containerRef.current
            const content = getContentElement()
            
            if (container && content) {
                let rect = cachedRectRef.current
                if (!rect || !container) {
                    rect = container?.getBoundingClientRect() ?? null
                    cachedRectRef.current = rect
                }
                if (!rect) return
                
                // Mouse position relative to container top-left
                const mouseX = e.clientX - rect.left
                const mouseY = e.clientY - rect.top

                // Calculate focal point preservation using top-left origin:
                // We find the normalized content coordinate (0 to 1 range across the element)
                // currently under the mouse, then ensure it remains there after scaling.
                const px = (mouseX - currentPosition.x) / currentScale
                const py = (mouseY - currentPosition.y) / currentScale

                const newPosition = {
                    x: mouseX - px * newScale,
                    y: mouseY - py * newScale,
                }

                // Numeric safety guard
                if (isNaN(newPosition.x) || isNaN(newPosition.y) || !isFinite(newPosition.x) || !isFinite(newPosition.y)) {
                    console.warn('Invalid zoom position calculated')
                    return
                }

                if (newScale === config.minScale) {
                    // When zooming back all the way, automatically re-center the content
                    const cw = rect.width // Use cached rect dimensions
                    const ch = rect.height
                    const iw = content.offsetWidth || cw
                    const ih = content.offsetHeight || ch
                    setPosition({
                        x: (cw - iw * newScale) / 2,
                        y: (ch - ih * newScale) / 2
                    })
                } else {
                    const clampedPosition = getClampedPosition(newPosition, newScale, content)
                    setPosition(clampedPosition)
                }
                setScale(newScale)
            }
        },
        [getClampedPosition, containerRef, getContentElement],
    )

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.addEventListener('wheel', handleWheelManual, { passive: false })
        return () => container.removeEventListener('wheel', handleWheelManual)
    }, [containerRef, handleWheelManual])

    /** Full reset: animates back to minScale and centers the content in the container */
    const reset = useCallback(() => {
        setIsTransitioning(true)
        setScale(config.minScale)
        
        const container = containerRef.current
        const content = getContentElement()
        if (container && content) {
            const cw = container.clientWidth
            const ch = container.clientHeight
            const iw = content.offsetWidth || cw
            const ih = content.offsetHeight || ch

            // Calculate center position for the base scale
            setPosition({
                x: (cw - iw * config.minScale) / 2,
                y: (ch - ih * config.minScale) / 2,
            })
        } else {
            setPosition({ x: 0, y: 0 })
        }

        setIsDragging(false)
        dragStartRef.current.hasDragged = false
        cachedRectRef.current = null
        pinchRef.current = {
            startDist: 0,
            initialScale: config.minScale,
            startX: 0,
            startY: 0,
            startPos: { x: 0, y: 0 },
        }
    }, [config.minScale, containerRef, getContentElement])

    /**
     * Programmatic zoom to a specific point in **container viewport coordinates** (pixels relative to top-left of container).
     * @param x Container-space X coordinate (like clientX - rect.left)
     * @param y Container-space Y coordinate
     * @param targetScale Optional zoom level (falls back to clickZoomScale)
     */
    const zoomTo = useCallback(
        (x: number, y: number, targetScale?: number) => {
            setIsTransitioning(true)
            const container = containerRef.current
            const content = getContentElement()
            if (!container || !content) return

            const ts = targetScale ?? config.clickZoomScale

            // Normalized point relative to top-left (0,0) focal math
            const px = (x - position.x) / scale
            const py = (y - position.y) / scale

            const np = {
                x: x - px * ts,
                y: y - py * ts,
            };

            // Numeric safety guard
            if (isNaN(np.x) || isNaN(np.y) || !isFinite(np.x) || !isFinite(np.y)) {
                return
            }

            const clamped = getClampedPosition(np, ts, content)
            setScale(ts)
            setPosition(clamped)
        },
        [containerRef, scale, position, config.clickZoomScale, getClampedPosition, getContentElement],
    )

    /** 
     * Zooms into the specific point in the container that was clicked.
     * Uses the focal point formula to keep the clicked pixel under the cursor.
     */
    const handleFocalZoom = useCallback(
        (e: React.MouseEvent<HTMLElement>) => {
            setIsTransitioning(true)
            const container = containerRef.current
            const content = e.currentTarget as HTMLElement
            if (!container || !content) return

            const rect = container.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const mouseY = e.clientY - rect.top

            // Focal transformation (top-left origin)
            const px = (mouseX - position.x) / scale
            const py = (mouseY - position.y) / scale

            const targetScale = config.clickZoomScale
            const newPosition = {
                x: mouseX - px * targetScale,
                y: mouseY - py * targetScale,
            }

            // Numeric safety guard
            if (isNaN(newPosition.x) || isNaN(newPosition.y) || !isFinite(newPosition.x) || !isFinite(newPosition.y)) {
                return
            }

            const clamped = getClampedPosition(newPosition, targetScale, content)
            setScale(targetScale)
            setPosition(clamped)
        },
        [containerRef, scale, position, config.clickZoomScale, getClampedPosition],
    )

    const onImageClick = useCallback(
        (e: React.MouseEvent<HTMLImageElement>) => {
            // Prevent zoom if user was dragging
            if (dragStartRef.current.hasDragged) {
                dragStartRef.current.hasDragged = false
                return
            }

            if (scale > config.minScale) {
                reset()
            } else {
                handleFocalZoom(e)
            }
        },
        [scale, reset, handleFocalZoom, config.minScale],
    )

    const onImageDoubleClick = useCallback(
        (e: React.MouseEvent<HTMLImageElement>) => {
            if (scale > config.minScale) {
                reset()
            } else {
                handleFocalZoom(e)
            }
        },
        [scale, reset, handleFocalZoom, config.minScale],
    )

    const getPinchPosition = useCallback((centerX: number, centerY: number, newScale: number): Position => {
        const { containerRect, startX, startY, initialScale, startPos } = pinchRef.current
        if (!containerRect) return { x: 0, y: 0 }

        const currentPinchX = centerX - containerRect.left
        const currentPinchY = centerY - containerRect.top

        const startPinchX = startX - containerRect.left
        const startPinchY = startY - containerRect.top

        // Content point under initial pinch center (top-left origin)
        const contentUnderStartX = (startPinchX - startPos.x) / initialScale
        const contentUnderStartY = (startPinchY - startPos.y) / initialScale

        // Keep that point under current fingers after zoom
        return {
            x: currentPinchX - contentUnderStartX * newScale,
            y: currentPinchY - contentUnderStartY * newScale,
        }
    }, [])

    const onImageTouchStart = useCallback(
        (e: React.TouchEvent<HTMLImageElement>) => {
            setIsTransitioning(false)
            swipeBlockedRef.current = e.touches.length === 2

            if (e.touches.length === 2) {
                // Pinch zoom
                const container = containerRef.current
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                )
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2

                const containerRect = container?.getBoundingClientRect() ?? null
                cachedRectRef.current = containerRect

                pinchRef.current = {
                    startDist: dist,
                    initialScale: scale,
                    startX: centerX,
                    startY: centerY,
                    startPos: { x: position.x, y: position.y },
                    containerRect
                }
            } else if (e.touches.length === 1) {
                // Double tap check
                const now = Date.now()
                const DOUBLE_TAP_MS = 300
                if (now - lastTapTimeRef.current < DOUBLE_TAP_MS) {
                    e.preventDefault()
                    if (scale > config.minScale) {
                        reset()
                    } else {
                        const touch = e.touches[0]
                        const container = containerRef.current
                        const rect = container?.getBoundingClientRect()
                        if (rect) {
                            zoomTo(
                                touch.clientX - rect.left,
                                touch.clientY - rect.top,
                                config.clickZoomScale
                            )
                        }
                    }
                    // Ignore next tap for 100ms to prevent triple-tap glitches
                    setTimeout(() => { lastTapTimeRef.current = 0 }, 100)
                    return
                }
                lastTapTimeRef.current = now

                if (scale > config.minScale) {
                    // Swipe navigation disabled when zoomed
                    setIsDragging(true)
                    cachedRectRef.current = containerRef.current?.getBoundingClientRect() ?? null
                    dragStartRef.current = {
                        x: e.touches[0].clientX - position.x,
                        y: e.touches[0].clientY - position.y,
                        hasDragged: false,
                        startX: e.touches[0].clientX,
                        startY: e.touches[0].clientY,
                    }
                }
            }
        },
        [scale, position, config.minScale, config.clickZoomScale, containerRef, reset, zoomTo, getContentElement, getClampedPosition],
    )

    const onImageTouchMove = useCallback(
        (e: React.TouchEvent<HTMLImageElement>) => {
            if (e.touches.length === 2) {
                // Pinch zoom
                e.preventDefault()
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                )
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2

                const ratio = dist / pinchRef.current.startDist
                const newScale = Math.min(Math.max(config.minScale, pinchRef.current.initialScale * ratio), config.maxScale)

                if (pinchRef.current.containerRect && newScale > config.minScale) {
                    const newPosition = getPinchPosition(
                        centerX, 
                        centerY, 
                        newScale, 
                    )
                    
                    // Numeric safety guard
                    if (isNaN(newPosition.x) || isNaN(newPosition.y) || !isFinite(newPosition.x) || !isFinite(newPosition.y)) {
                        return
                    }

                    const clampedPosition = getClampedPosition(
                        newPosition,
                        newScale,
                        getContentElement() as HTMLElement,
                    )
                    setPosition(clampedPosition)
                } else {
                    // Auto-recenter when reaching min scale or if container missing
                    const container = containerRef.current
                    const content = getContentElement()
                    if (container && content) {
                        const cw = pinchRef.current.containerRect?.width ?? container?.clientWidth ?? 0
                        const ch = pinchRef.current.containerRect?.height ?? container?.clientHeight ?? 0
                        const iw = content.offsetWidth || cw
                        const ih = content.offsetHeight || ch
                        setPosition({
                            x: (cw - iw * newScale) / 2,
                            y: (ch - ih * newScale) / 2,
                        })
                    } else {
                        setPosition({ x: 0, y: 0 })
                    }
                }
                setScale(newScale)
            } else if (e.touches.length === 1 && isDragging && scale > config.minScale) {
                // Pan when zoomed
                e.preventDefault()
                const touchX = e.touches[0].clientX
                const touchY = e.touches[0].clientY

                if (!dragStartRef.current.hasDragged) {
                    const moveDist = Math.hypot(
                        touchX - dragStartRef.current.startX,
                        touchY - dragStartRef.current.startY,
                    )
                    if (moveDist > config.dragThresholdTouch) {
                        dragStartRef.current.hasDragged = true
                    }
                }

                if (dragStartRef.current.hasDragged) {
                    const newPosition = {
                        x: touchX - dragStartRef.current.x,
                        y: touchY - dragStartRef.current.y,
                    }

                    const clampedPosition = getClampedPosition(newPosition, scale, e.currentTarget)
                    setPosition(clampedPosition)
                }
            }
        },
        [isDragging, scale, getClampedPosition, getContentElement, getPinchPosition, config.minScale, config.maxScale, config.dragThresholdTouch],
    )

    const onImageTouchEnd = useCallback(() => {
        setIsDragging(false)
        // Reset pinch state to avoid stale calculations
        pinchRef.current = {
            startDist: 0,
            initialScale: scale,
            startX: 0,
            startY: 0,
            startPos: { x: position.x, y: position.y },
        }
    }, [scale, position])

    const onImageMouseDown = useCallback(
        (e: React.MouseEvent<HTMLImageElement>) => {
            setIsTransitioning(false)
            if (scale > config.minScale) {
                e.preventDefault()
                setIsDragging(true)
                dragStartRef.current = {
                    x: e.clientX - position.x,
                    y: e.clientY - position.y,
                    hasDragged: false,
                    startX: e.clientX,
                    startY: e.clientY,
                }
            }
        },
        [scale, position, config.minScale],
    )

    const handleSwipe = useCallback(
        (targetX: number, targetY: number) => {
            if (!config.enableSwipe) return

            const distanceX = Math.abs(targetX - dragStartRef.current.startX)
            const distanceY = Math.abs(targetY - dragStartRef.current.startY)

            // Only consider as swipe if movement is predominantly horizontal
            if (distanceX > config.swipeThreshold && distanceX > distanceY) {
                if (targetX < dragStartRef.current.startX) {
                    onNext?.()
                } else {
                    onPrev?.()
                }
            }
        },
        [config.enableSwipe, config.swipeThreshold, onNext, onPrev]
    )

    const onImageMouseMove = useCallback(
        (e: React.MouseEvent<HTMLImageElement>) => {
            if (isDragging && scale > config.minScale) {
                e.preventDefault()

                if (!dragStartRef.current.hasDragged) {
                    const moveDist = Math.hypot(
                        e.clientX - dragStartRef.current.startX,
                        e.clientY - dragStartRef.current.startY,
                    )
                    if (moveDist > config.dragThresholdMouse) {
                        dragStartRef.current.hasDragged = true
                    }
                }

                if (dragStartRef.current.hasDragged) {
                    const newPosition = {
                        x: e.clientX - dragStartRef.current.x,
                        y: e.clientY - dragStartRef.current.y,
                    }

                    const clampedPosition = getClampedPosition(newPosition, scale, e.currentTarget)
                    setPosition(clampedPosition)
                }
            }
        },
        [isDragging, scale, getClampedPosition, config.minScale, config.dragThresholdMouse],
    )

    const onImageMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    const onImageMouseLeave = useCallback(() => {
        setIsDragging(false)
    }, [])

    const onContainerTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (scale > config.minScale) return
            const touch = e.changedTouches[0]
            touchStartXRef.current = touch.clientX
        },
        [scale, config.minScale],
    )

    const onContainerTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (swipeBlockedRef.current) {
                swipeBlockedRef.current = false
                return
            }
            if (scale > config.minScale) return
            const touch = e.changedTouches[0]
            const startX = touchStartXRef.current
            const endX = touch.clientX
            const diff = startX - endX

            if (Math.abs(diff) > config.swipeThreshold) {
                if (diff > 0) {
                    onNext?.()
                } else {
                    onPrev?.()
                }
            }
        },
        [scale, onNext, onPrev, config.minScale, config.swipeThreshold],
    )

    const onContainerMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (scale > config.minScale) return
            touchStartXRef.current = e.clientX
        },
        [scale, config.minScale],
    )

    const onContainerMouseUp = useCallback(
        (e: React.MouseEvent) => {
            if (scale > config.minScale) return
            const startX = touchStartXRef.current
            const endX = e.clientX
            const diff = startX - endX

            if (Math.abs(diff) > config.swipeThreshold) {
                if (diff > 0) {
                    onNext?.()
                } else {
                    onPrev?.()
                }
            }
        },
        [scale, onNext, onPrev, config.minScale, config.swipeThreshold],
    )

    // Clear transition state after duration completes
    useEffect(() => {
        if (!isTransitioning) return
        const timer = setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION)
        return () => clearTimeout(timer)
    }, [isTransitioning])

    // Cleanup handled in main effect hook above

    const contentStyle = React.useMemo(() => {
        const style: React.CSSProperties = {
            transformOrigin: '0 0',
            transition: isTransitioning ? `transform ${TRANSITION_DURATION}ms ${TRANSITION_CURVE}` : 'none',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
        }

        if (config.manageCursor) {
            if (isDragging) {
                style.cursor = 'grabbing'
            } else if (scale > config.minScale) {
                style.cursor = 'grab'
            } else if (enableZoom) {
                style.cursor = 'zoom-in'
            } else {
                style.cursor = 'default'
            }
        }

        return style
    }, [isTransitioning, config.manageCursor, isDragging, scale, config.minScale, enableZoom])

    const contentProps = React.useMemo(() => ({
        ref: contentRef as React.Ref<any>, // Cast to compatible ref type
        style: contentStyle,
        onClick: onImageClick,
        onDoubleClick: onImageDoubleClick,
        onTouchStart: onImageTouchStart,
        onTouchMove: onImageTouchMove,
        onTouchEnd: onImageTouchEnd,
        onMouseDown: onImageMouseDown,
        onMouseMove: onImageMouseMove,
        onMouseUp: onImageMouseUp,
        onMouseLeave: onImageMouseLeave,
    }), [
        contentStyle,
        onImageClick,
        onImageDoubleClick,
        onImageTouchStart,
        onImageTouchMove,
        onImageTouchEnd,
        onImageMouseDown,
        onImageMouseMove,
        onImageMouseUp,
        onImageMouseLeave
    ])

    const containerProps = React.useMemo(() => ({
        onTouchStart: onContainerTouchStart,
        onTouchEnd: onContainerTouchEnd,
        onMouseDown: onContainerMouseDown,
        onMouseUp: onContainerMouseUp,
    }), [
        onContainerTouchStart,
        onContainerTouchEnd,
        onContainerMouseDown,
        onContainerMouseUp
    ])

    return {
        scale,
        position,
        isDragging,
        reset,
        zoomTo,
        contentProps,
        containerProps,
    }
}