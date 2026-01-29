'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

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

interface ZoomPanProps {
    /** Reference to the container element (div, section, etc.) */
    containerRef: React.RefObject<HTMLElement | null>
    enableZoom?: boolean
    onNext?: () => void
    onPrev?: () => void
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
    /** Cached container rect for performant coordinate mapping */
    containerRect?: DOMRect
}

// Helper functions for boundary calculations
interface Bounds {
    xLimit: number
    yLimit: number
}

const calculateBounds = (
    targetScale: number,
    container: HTMLElement | null,
    element: HTMLElement | null,
    boundsBuffer: number
): Bounds => {
    if (!container || !element) return { xLimit: 0, yLimit: 0 }

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const elementWidth = element.offsetWidth || containerWidth
    const elementHeight = element.offsetHeight || containerHeight

    const scaledWidth = elementWidth * targetScale
    const scaledHeight = elementHeight * targetScale

    const xLimit = (scaledWidth <= containerWidth ? 0 : (scaledWidth - containerWidth) / 2) + boundsBuffer
    const yLimit = (scaledHeight <= containerHeight ? 0 : (scaledHeight - containerHeight) / 2) + boundsBuffer

    return { xLimit, yLimit }
}

const clampPosition = (
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
        }

        const handleBlur = () => {
            setIsDragging(false)
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
        if (!container) return

        const observer = new ResizeObserver(() => {
            updateBoundsAndClamp()
        })

        observer.observe(container)
        
        // Also listen for image loads in the content
        const content = getContentElement()
        if (content instanceof HTMLImageElement && !content.complete) {
            content.addEventListener('load', updateBoundsAndClamp)
        }

        return () => {
            observer.disconnect()
            if (content instanceof HTMLImageElement) {
                content.removeEventListener('load', updateBoundsAndClamp)
            }
        }
    }, [containerRef, updateBoundsAndClamp, getContentElement])

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

    const handleWheelManual = useCallback(
        (e: WheelEvent) => {
            if (!stateRef.current.enableZoom) return
            setIsTransitioning(false) // Cancel any active transition
            e.preventDefault()

            const { scale: currentScale, position: currentPosition, config } = stateRef.current
            
            // Normalize deltaY: Trackpads often send small deltas, physical wheels send large ones.
            const delta = normalizeWheelDelta(e, config.zoomSensitivity)
            const newScale = Math.min(Math.max(config.minScale, currentScale + delta), config.maxScale)

            if (newScale === config.minScale) {
                setScale(config.minScale)
                setPosition({ x: 0, y: 0 })
            } else {
                const container = containerRef.current
                const content = getContentElement()
            if (container && content) {
                const rect = container.getBoundingClientRect()
                    const containerWidth = rect.width
                    const containerHeight = rect.height
                    const centerX = containerWidth / 2
                    const centerY = containerHeight / 2

                    // Mouse position relative to container center
                    const mouseX = e.clientX - (rect.left + centerX)
                    const mouseY = e.clientY - (rect.top + centerY)

                    // Content coordinate at mouse position
                    const contentX = (mouseX - currentPosition.x) / currentScale
                    const contentY = (mouseY - currentPosition.y) / currentScale

                    // New position maintaining the mouse over the same content point
                    const newPosition = {
                        x: mouseX - contentX * newScale,
                        y: mouseY - contentY * newScale,
                    }

                    const clampedPosition = getClampedPosition(newPosition, newScale, content)
                    setPosition(clampedPosition)
                    setScale(newScale)
                }
            }
        },
        [getClampedPosition, containerRef, getContentElement, config.zoomSensitivity, config.minScale, config.maxScale],
    )

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.addEventListener('wheel', handleWheelManual, { passive: false })
        return () => container.removeEventListener('wheel', handleWheelManual)
    }, [containerRef, handleWheelManual])

    const reset = useCallback(() => {
        setIsTransitioning(true)
        setScale(config.minScale)
        setPosition({ x: 0, y: 0 })
        setIsDragging(false)
        dragStartRef.current.hasDragged = false
        pinchRef.current = {
            startDist: 0,
            initialScale: config.minScale,
            startX: 0,
            startY: 0,
            startPos: { x: 0, y: 0 },
        }
    }, [config.minScale])

    const handleFocalZoom = useCallback(
        (e: React.MouseEvent<HTMLElement>) => {
            setIsTransitioning(true)
            const container = containerRef.current
            const target = e.currentTarget
            if (!container || !target) return

            const rect = container.getBoundingClientRect()
            const containerWidth = container.clientWidth
            const containerHeight = container.clientHeight
            const centerX = containerWidth / 2
            const centerY = containerHeight / 2

            // Mouse position relative to container center
            const mouseX = e.clientX - (rect.left + centerX)
            const mouseY = e.clientY - (rect.top + centerY)

            const newPosition = {
                x: mouseX * (1 - config.clickZoomScale),
                y: mouseY * (1 - config.clickZoomScale),
            }

            const clampedPosition = getClampedPosition(newPosition, config.clickZoomScale, target)

            setScale(config.clickZoomScale)
            setPosition(clampedPosition)
        },
        [getClampedPosition, config.clickZoomScale, containerRef],
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

        const containerCenterX = containerRect.width / 2
        const containerCenterY = containerRect.height / 2

        // Pinch center relative to container center
        const currentPinchX = centerX - (containerRect.left + containerCenterX)
        const currentPinchY = centerY - (containerRect.top + containerCenterY)
        
        // Initial pinch center relative to container center
        const startPinchX = startX - (containerRect.left + containerCenterX)
        const startPinchY = startY - (containerRect.top + containerCenterY)

        const scaleRatio = newScale / initialScale
        const pinchImageX = startPinchX - startPos.x
        const pinchImageY = startPinchY - startPos.y

        return {
            x: currentPinchX - pinchImageX * scaleRatio,
            y: currentPinchY - pinchImageY * scaleRatio,
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

                pinchRef.current = {
                    startDist: dist,
                    initialScale: scale,
                    startX: centerX,
                    startY: centerY,
                    startPos: { x: position.x, y: position.y },
                    containerRect: container?.getBoundingClientRect()
                }
            } else if (e.touches.length === 1 && scale > config.minScale) {
                // Swipe navigation disabled when zoomed
                setIsDragging(true)
                dragStartRef.current = {
                    x: e.touches[0].clientX - position.x,
                    y: e.touches[0].clientY - position.y,
                    hasDragged: false,
                    startX: e.touches[0].clientX,
                    startY: e.touches[0].clientY,
                }
            }
        },
        [scale, position, config.minScale, containerRef],
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
                    
                    const clampedPosition = getClampedPosition(
                        newPosition,
                        newScale,
                        getContentElement() as HTMLElement,
                    )
                    setPosition(clampedPosition)
                } else {
                    setPosition({ x: 0, y: 0 })
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

    const zoomTo = useCallback(
        (x: number, y: number, targetScale?: number) => {
            setIsTransitioning(true)
            const container = containerRef.current
            const content = contentRef.current || container?.firstElementChild as HTMLElement
            if (!container || !content) return

            const scaleToUse = targetScale ?? config.clickZoomScale
            const contentWidth = content.offsetWidth
            const contentHeight = content.offsetHeight
            
            // Calculate position to center the (x, y) point
            // Since transform-origin is center (default), the offset to center a point (x,y) is:
            // (CenterOfContent - TargetPoint) * Scale
            const newPosition = {
                x: (contentWidth / 2 - x) * scaleToUse,
                y: (contentHeight / 2 - y) * scaleToUse,
            }

            const clampedPosition = getClampedPosition(newPosition, scaleToUse, content)

            setScale(scaleToUse)
            setPosition(clampedPosition)
        },
        [getClampedPosition, config.clickZoomScale, containerRef],
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
            transformOrigin: 'center',
            transition: isTransitioning ? `transform ${TRANSITION_DURATION}ms ${TRANSITION_CURVE}` : 'none'
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