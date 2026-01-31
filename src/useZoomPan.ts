'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Position, ZoomPanProps, DragState, PinchState, GestureType } from './types'
import { DEFAULT_OPTIONS, TRANSITION_DURATION, TRANSITION_CURVE } from './constants'
import { clampPosition, normalizeWheelDelta } from './utils'

/**
 * A highly optimized hook for zoom and pan interactions.
 * Supports mouse wheel, dragging, double-click to focal zoom, and pinch-to-zoom on touch.
 */
export const useZoomPan = <T extends HTMLElement = HTMLElement>({
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



    /**
     * Converts container-relative (clientX/Y) to element-relative (at scale 1) coordinates.
     * (0, 0) is the center of the original content.
     */
    const getPointOnContent = useCallback((clientX: number, clientY: number, currentScale: number, currentPosition: Position): Position => {
        const container = containerRef.current
        if (!container) return { x: 0, y: 0 }

        const rect = cachedRectRef.current || container.getBoundingClientRect()
        const content = getContentElement()
        if (!content) return { x: 0, y: 0 }

        // Get current visual center of content on screen
        // In a symmetrical layout, the "natural center" is the container center.
        const contentCenterScreen = {
            x: rect.left + rect.width / 2 + currentPosition.x,
            y: rect.top + rect.height / 2 + currentPosition.y,
        }

        // World coord = (screen pos - content center on screen) / scale
        return {
            x: (clientX - contentCenterScreen.x) / currentScale,
            y: (clientY - contentCenterScreen.y) / currentScale,
        }
    }, [containerRef, getContentElement])

    const [scale, setScale] = useState(config.initialScale ?? config.minScale)
    const [position, setPosition] = useState<Position>(config.initialPosition ?? { x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [isMouseOver, setIsMouseOver] = useState(false)
    
    // Safety guard for rapid animations
    const isAnimating = useRef(false)
    
    // Gesture tracking
    const activeGesture = useRef<GestureType>('none')

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
            activeGesture.current = 'none'
        }

        const handleBlur = () => {
            setIsDragging(false)
            cachedRectRef.current = null
            activeGesture.current = 'none'
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
        const currentScale = stateRef.current.scale
        
        // Auto-recenter when zoomed all the way out
        if (currentScale <= config.minScale + 0.001) {
            setPosition({ x: 0, y: 0 })
            return
        }

        const clamped = clampPosition(currentPos, currentScale, container, content, config.boundsBuffer)
        if (clamped.x !== currentPos.x || clamped.y !== currentPos.y) {
            setPosition(clamped)
        }
    }, [containerRef, config.boundsBuffer, config.minScale, getContentElement])

    // Keyboard navigation
    useLayoutEffect(() => {
        const container = containerRef.current
        const content = getContentElement()
        if (!container || !content) return

        // Initial centering
        if (position.x === 0 && position.y === 0 && scale === (config.initialScale ?? config.minScale)) {
            setPosition({ x: 0, y: 0 })
        }

        const observer = new ResizeObserver(() => {
            updateBoundsAndClamp()
        })

        observer.observe(container)
        
        // Also listen for image loads in the content
        const handleLoad = () => updateBoundsAndClamp()
        
        if (content instanceof HTMLImageElement && !content.complete) {
            content.addEventListener('load', handleLoad)
        }

        return () => {
            observer.disconnect()
            if (content instanceof HTMLImageElement) {
                content.removeEventListener('load', handleLoad)
            }
        }
    }, [containerRef, getContentElement, config.initialScale, config.minScale, scale, updateBoundsAndClamp])

    /**
     * Internal handler for manual wheel events. 
     */
    const handleWheelManual = useCallback(
        (e: WheelEvent) => {
            if (!stateRef.current.enableZoom) return
            setIsTransitioning(false) 
            e.preventDefault()

            const { scale: currentScale, position: currentPosition, config } = stateRef.current
            
            const delta = normalizeWheelDelta(e, config.zoomSensitivity)
            const newScale = Math.min(Math.max(config.minScale, currentScale + delta), config.maxScale)

            if (Math.abs(newScale - currentScale) < 0.0001) return 

            const container = containerRef.current
            const content = getContentElement()
            
            if (container && content) {
                const rect = cachedRectRef.current || container.getBoundingClientRect()
                const { x: worldX, y: worldY } = getPointOnContent(e.clientX, e.clientY, currentScale, currentPosition)

                const mouseInContainerX = e.clientX - rect.left
                const mouseInContainerY = e.clientY - rect.top

                const newPosition = {
                    x: mouseInContainerX - rect.width / 2 - worldX * newScale,
                    y: mouseInContainerY - rect.height / 2 - worldY * newScale,
                }

                if (isNaN(newPosition.x) || isNaN(newPosition.y) || !isFinite(newPosition.x) || !isFinite(newPosition.y)) {
                    return
                }

                const clampedPosition = clampPosition(newPosition, newScale, container, content, config.boundsBuffer)
                setPosition(clampedPosition)
                setScale(newScale)
            }
        },
        [containerRef, getContentElement, getPointOnContent],
    )

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.addEventListener('wheel', handleWheelManual, { passive: false })
        return () => container.removeEventListener('wheel', handleWheelManual)
    }, [containerRef, handleWheelManual])

    /** Full reset */
    const reset = useCallback(() => {
        if (isAnimating.current) return
        isAnimating.current = true
        
        setIsTransitioning(true)
        setScale(config.minScale)
        setPosition({ x: 0, y: 0 })

        setIsDragging(false)
        dragStartRef.current.hasDragged = false
        cachedRectRef.current = null
        activeGesture.current = 'none'
        
        setTimeout(() => {
            isAnimating.current = false
        }, TRANSITION_DURATION)
    }, [config.minScale])

    /**
     * Programmatic zoom to a specific point
     */
    const zoomTo = useCallback(
        (x: number, y: number, targetScale?: number, targetScreenX?: number, targetScreenY?: number, cachedRect?: DOMRect) => {
            if (isAnimating.current) return
            isAnimating.current = true

            setIsTransitioning(true)
            const container = containerRef.current
            const content = getContentElement()
            if (!container || !content) {
                isAnimating.current = false
                return
            }

            const scaleToUse = Math.min(Math.max(config.minScale, targetScale ?? config.clickZoomScale), config.maxScale)
            const rect = cachedRect || container.getBoundingClientRect()
            
            // Default to container center if no target given (for keyboard +/- etc.)
            const desiredX = targetScreenX ?? rect.width / 2
            const desiredY = targetScreenY ?? rect.height / 2

            // Formula: translate so that world point x/y lands at screen location desiredX/Y
            const newPosition = {
                x: desiredX - rect.width / 2 - x * scaleToUse,
                y: desiredY - rect.height / 2 - y * scaleToUse,
            }

            if (isNaN(newPosition.x) || isNaN(newPosition.y) || !isFinite(newPosition.x) || !isFinite(newPosition.y)) {
                isAnimating.current = false
                return
            }

            const clampedPosition = clampPosition(newPosition, scaleToUse, container, content, config.boundsBuffer)

            setScale(scaleToUse)
            setPosition(clampedPosition)
            
            setTimeout(() => {
                isAnimating.current = false
            }, TRANSITION_DURATION)
        },
        [config.minScale, config.clickZoomScale, config.maxScale, config.boundsBuffer, containerRef, getContentElement],
    )

    /** 
     * Zooms into the specific point in the container that was clicked.
     */
    const handleFocalZoom = useCallback(
        (e: React.MouseEvent<HTMLElement>) => {
            const container = containerRef.current
            if (!container) return

            const rect = container.getBoundingClientRect()
            const clickInContainerX = e.clientX - rect.left
            const clickInContainerY = e.clientY - rect.top

            const { x, y } = getPointOnContent(e.clientX, e.clientY, scale, position)
            zoomTo(x, y, config.clickZoomScale, clickInContainerX, clickInContainerY, rect)
        },
        [containerRef, zoomTo, config.clickZoomScale, getPointOnContent, scale, position],
    )

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!enableZoom) return
        
        // Scope keyboard shortcuts to focus or mouse-over state
        const activeElement = document.activeElement
        const isFocused = contentRef.current === activeElement || containerRef.current === activeElement || containerRef.current?.contains(activeElement)
        
        if (!isFocused && !isMouseOver) return

        // Ignore if user is typing in an input
        if (activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            (activeElement as HTMLElement).isContentEditable
        )) {
            return
        }

        // If moused over or focused, handle shortcuts. 
        // We handle +/- regardless of Meta/Ctrl if we are moused over/focused.
        const container = containerRef.current
        const content = getContentElement()
        if (!container || !content) return

        const centerRelativeX = 0 // Center of content
        const centerRelativeY = 0

        const PAN_STEP = 50
        const ZOOM_STEP = 1.2

        switch(e.key) {
            case '+':
            case '=':
                e.preventDefault()
                zoomTo(centerRelativeX, centerRelativeY, scale * ZOOM_STEP)
                break
            case '-':
            case '_':
                e.preventDefault()
                zoomTo(centerRelativeX, centerRelativeY, scale / ZOOM_STEP)
                break
            case 'ArrowLeft':
                e.preventDefault()
                setPosition(p => clampPosition({ ...p, x: p.x + PAN_STEP }, scale, container, content, config.boundsBuffer))
                break
            case 'ArrowRight':
                e.preventDefault()
                setPosition(p => clampPosition({ ...p, x: p.x - PAN_STEP }, scale, container, content, config.boundsBuffer))
                break
            case 'ArrowUp':
                e.preventDefault()
                setPosition(p => clampPosition({ ...p, y: p.y + PAN_STEP }, scale, container, content, config.boundsBuffer))
                break
            case 'ArrowDown':
                e.preventDefault()
                setPosition(p => clampPosition({ ...p, y: p.y - PAN_STEP }, scale, container, content, config.boundsBuffer))
                break
            case 'Escape':
                e.preventDefault()
                reset()
                break
        }
    }, [enableZoom, scale, containerRef, getContentElement, config.boundsBuffer, zoomTo, reset, isMouseOver])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    const onImageClick = useCallback(
        (e: React.MouseEvent<T>) => {
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
        (e: React.MouseEvent<T>) => {
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

        const { x: worldX, y: worldY } = getPointOnContent(startX, startY, initialScale, startPos)
        
        const pinchInContainerX = centerX - containerRect.left
        const pinchInContainerY = centerY - containerRect.top

        return {
            x: pinchInContainerX - containerRect.width / 2 - worldX * newScale,
            y: pinchInContainerY - containerRect.height / 2 - worldY * newScale,
        }
    }, [getPointOnContent])

    const onImageTouchStart = useCallback(
        (e: React.TouchEvent<T>) => {
            setIsTransitioning(false)
            swipeBlockedRef.current = e.touches.length === 2

            if (e.touches.length === 2) {
                activeGesture.current = 'pinch'
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
                const now = Date.now()
                const DOUBLE_TAP_MS = 300
                if (now - lastTapTimeRef.current < DOUBLE_TAP_MS) {
                    e.preventDefault()
                    if (scale > config.minScale) {
                        reset()
                    } else {
                        const touch = e.touches[0]
                        const container = containerRef.current
                        if (container) {
                            const rect = container.getBoundingClientRect()
                            const touchInContainerX = touch.clientX - rect.left
                            const touchInContainerY = touch.clientY - rect.top
                            const { x, y } = getPointOnContent(touch.clientX, touch.clientY, scale, position)
                            zoomTo(x, y, config.clickZoomScale, touchInContainerX, touchInContainerY, rect)
                        }
                    }
                    setTimeout(() => { lastTapTimeRef.current = 0 }, 100)
                    return
                }
                lastTapTimeRef.current = now

                if (scale > config.minScale) {
                    activeGesture.current = 'drag'
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
        [scale, position, config.minScale, config.clickZoomScale, containerRef, reset, zoomTo],
    )

    const onImageTouchMove = useCallback(
        (e: React.TouchEvent<T>) => {
            if (activeGesture.current === 'pinch' && e.touches.length === 2) {
                e.preventDefault()
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                )
                const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
                const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2

                const ratio = dist / pinchRef.current.startDist
                const newScale = Math.min(Math.max(config.minScale, pinchRef.current.initialScale * ratio), config.maxScale)

                const container = containerRef.current
                const content = getContentElement()

                if (pinchRef.current.containerRect && newScale > config.minScale && container && content) {
                    const newPosition = getPinchPosition(centerX, centerY, newScale)
                    
                    if (isNaN(newPosition.x) || isNaN(newPosition.y) || !isFinite(newPosition.x) || !isFinite(newPosition.y)) {
                        return
                    }

                    const clampedPosition = clampPosition(newPosition, newScale, container, content, config.boundsBuffer)
                    setPosition(clampedPosition)
                } else if (container && content) {
                    setPosition({ x: 0, y: 0 })
                }
                setScale(newScale)
            } else if (activeGesture.current === 'drag' && e.touches.length === 1 && isDragging && scale > config.minScale) {
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

                    const container = containerRef.current
                    const content = getContentElement()
                    if (container && content) {
                        const clampedPosition = clampPosition(newPosition, scale, container, content, config.boundsBuffer)
                        setPosition(clampedPosition)
                    }
                }
            }
        },
        [isDragging, scale, getContentElement, getPinchPosition, config.minScale, config.maxScale, config.dragThresholdTouch, config.boundsBuffer, containerRef],
    )

    const onImageTouchEnd = useCallback(() => {
        setIsDragging(false)
        activeGesture.current = 'none'
        pinchRef.current = {
            startDist: 0,
            initialScale: scale,
            startX: 0,
            startY: 0,
            startPos: { x: position.x, y: position.y },
        }
    }, [scale, position])

    const onImageMouseDown = useCallback(
        (e: React.MouseEvent<T>) => {
            setIsTransitioning(false)
            if (scale > config.minScale) {
                e.preventDefault()
                setIsDragging(true)
                activeGesture.current = 'drag'
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

    const onImageMouseMove = useCallback(
        (e: React.MouseEvent<T>) => {
            if (activeGesture.current === 'drag' && isDragging && scale > config.minScale) {
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

                    const container = containerRef.current
                    const content = getContentElement()
                    if (container && content) {
                        const clampedPosition = clampPosition(newPosition, scale, container, content, config.boundsBuffer)
                        setPosition(clampedPosition)
                    }
                }
            }
        },
        [isDragging, scale, config.minScale, config.dragThresholdMouse, config.boundsBuffer, containerRef, getContentElement],
    )

    const onImageMouseUp = useCallback(() => {
        setIsDragging(false)
        activeGesture.current = 'none'
    }, [])

    const onImageMouseLeave = useCallback(() => {
        setIsDragging(false)
        activeGesture.current = 'none'
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

    useEffect(() => {
        if (!isTransitioning) return
        const timer = setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION)
        return () => clearTimeout(timer)
    }, [isTransitioning])

    const contentStyle = React.useMemo(() => {
        const style: React.CSSProperties = {
            transformOrigin: 'center',
            transition: (isTransitioning && activeGesture.current === 'none') ? `transform ${TRANSITION_DURATION}ms ${TRANSITION_CURVE}` : 'none',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            willChange: 'transform',
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
    }, [isTransitioning, config.manageCursor, isDragging, scale, config.minScale, enableZoom, position.x, position.y])

    const contentProps = React.useMemo(() => ({
        ref: (node: HTMLElement | null) => {
            contentRef.current = node
        },
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
        tabIndex: 0,
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
        onMouseEnter: () => setIsMouseOver(true),
        onMouseLeave: () => setIsMouseOver(false),
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