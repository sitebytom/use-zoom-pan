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

    const contentRef = React.useRef<T | null>(null)

    // Internal helper to get content element
    const getContentElement = useCallback(() => {
        return (contentRef.current || containerRef.current?.firstElementChild) as T | null
    }, [containerRef])

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
        const clamped = clampPosition(currentPos, stateRef.current.scale, container, content, config.boundsBuffer)
        if (clamped.x !== currentPos.x || clamped.y !== currentPos.y) {
            setPosition(clamped)
        }
    }, [containerRef, config.boundsBuffer, getContentElement])

    // Keyboard navigation
    useLayoutEffect(() => {
        const container = containerRef.current
        const content = getContentElement()
        if (!container || !content) return

        // Initial centering
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

            if (newScale === currentScale) return 

            const container = containerRef.current
            const content = getContentElement()
            
            if (container && content) {
                let rect = cachedRectRef.current
                if (!rect || !container) {
                    rect = container?.getBoundingClientRect() ?? null
                    cachedRectRef.current = rect
                }
                if (!rect) return
                
                const mouseX = e.clientX - rect.left
                const mouseY = e.clientY - rect.top

                const px = (mouseX - currentPosition.x) / currentScale
                const py = (mouseY - currentPosition.y) / currentScale

                const newPosition = {
                    x: mouseX - px * newScale,
                    y: mouseY - py * newScale,
                }

                if (isNaN(newPosition.x) || isNaN(newPosition.y) || !isFinite(newPosition.x) || !isFinite(newPosition.y)) {
                    return
                }

                if (newScale === config.minScale) {
                    const cw = rect.width 
                    const ch = rect.height
                    const iw = content.offsetWidth || cw
                    const ih = content.offsetHeight || ch
                    setPosition({
                        x: (cw - iw * newScale) / 2,
                        y: (ch - ih * newScale) / 2
                    })
                } else {
                    const clampedPosition = clampPosition(newPosition, newScale, container, content, config.boundsBuffer)
                    setPosition(clampedPosition)
                }
                setScale(newScale)
            }
        },
        [containerRef, getContentElement],
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
        
        const container = containerRef.current
        const content = getContentElement()
        if (container && content) {
            const cw = container.clientWidth
            const ch = container.clientHeight
            const iw = content.offsetWidth || cw
            const ih = content.offsetHeight || ch

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
        activeGesture.current = 'none'
        
        setTimeout(() => {
            isAnimating.current = false
        }, TRANSITION_DURATION)
    }, [config.minScale, containerRef, getContentElement])

    /**
     * Programmatic zoom to a specific point
     */
    const zoomTo = useCallback(
        (x: number, y: number, targetScale?: number) => {
            if (isAnimating.current) return
            isAnimating.current = true

            setIsTransitioning(true)
            const container = containerRef.current
            const content = getContentElement()
            if (!container || !content) {
                isAnimating.current = false
                return
            }

            const ts = Math.min(Math.max(config.minScale, targetScale ?? config.clickZoomScale), config.maxScale)

            const px = (x - position.x) / scale
            const py = (y - position.y) / scale

            const np = {
                x: x - px * ts,
                y: y - py * ts,
            };

            if (isNaN(np.x) || isNaN(np.y) || !isFinite(np.x) || !isFinite(np.y)) {
                isAnimating.current = false
                return
            }

            const clamped = clampPosition(np, ts, container, content, config.boundsBuffer)
            setScale(ts)
            setPosition(clamped)
            
            setTimeout(() => {
                isAnimating.current = false
            }, TRANSITION_DURATION)
        },
        [containerRef, scale, position, config.clickZoomScale, config.minScale, config.maxScale, config.boundsBuffer, getContentElement],
    )

    /** 
     * Zooms into the specific point in the container that was clicked.
     */
    const handleFocalZoom = useCallback(
        (e: React.MouseEvent<HTMLElement>) => {
            const container = containerRef.current
            if (!container) return

            const rect = container.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const mouseY = e.clientY - rect.top

            zoomTo(mouseX, mouseY, config.clickZoomScale)
        },
        [containerRef, zoomTo, config.clickZoomScale],
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
        if (!container) return

        let rect = cachedRectRef.current
        if (!rect) {
            rect = container.getBoundingClientRect()
            cachedRectRef.current = rect
        }
        
        const centerX = rect.width / 2
        const centerY = rect.height / 2

        const PAN_STEP = 50
        const ZOOM_STEP = 1.2

        switch(e.key) {
            case '+':
            case '=':
                e.preventDefault()
                zoomTo(centerX, centerY, scale * ZOOM_STEP)
                break
            case '-':
            case '_':
                e.preventDefault()
                zoomTo(centerX, centerY, scale / ZOOM_STEP)
                break
            case 'ArrowLeft':
                e.preventDefault()
                setPosition(p => clampPosition({ ...p, x: p.x + PAN_STEP }, scale, container, getContentElement(), config.boundsBuffer))
                break
            case 'ArrowRight':
                e.preventDefault()
                setPosition(p => clampPosition({ ...p, x: p.x - PAN_STEP }, scale, container, getContentElement(), config.boundsBuffer))
                break
            case 'ArrowUp':
                e.preventDefault()
                setPosition(p => clampPosition({ ...p, y: p.y + PAN_STEP }, scale, container, getContentElement(), config.boundsBuffer))
                break
            case 'ArrowDown':
                e.preventDefault()
                setPosition(p => clampPosition({ ...p, y: p.y - PAN_STEP }, scale, container, getContentElement(), config.boundsBuffer))
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

        const currentPinchX = centerX - containerRect.left
        const currentPinchY = centerY - containerRect.top

        const startPinchX = startX - containerRect.left
        const startPinchY = startY - containerRect.top

        const contentUnderStartX = (startPinchX - startPos.x) / initialScale
        const contentUnderStartY = (startPinchY - startPos.y) / initialScale

        return {
            x: currentPinchX - contentUnderStartX * newScale,
            y: currentPinchY - contentUnderStartY * newScale,
        }
    }, [])

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
                        const rect = container?.getBoundingClientRect()
                        if (rect) {
                            zoomTo(
                                touch.clientX - rect.left,
                                touch.clientY - rect.top,
                                config.clickZoomScale
                            )
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
                    const cw = pinchRef.current.containerRect?.width ?? container.clientWidth
                    const ch = pinchRef.current.containerRect?.height ?? container.clientHeight
                    const iw = content.offsetWidth || cw
                    const ih = content.offsetHeight || ch
                    setPosition({
                        x: (cw - iw * newScale) / 2,
                        y: (ch - ih * newScale) / 2,
                    })
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
        const style: React.CSSProperties & { [key: string]: any } = {
            transformOrigin: '0 0',
            transition: isTransitioning ? `transform ${TRANSITION_DURATION}ms ${TRANSITION_CURVE}` : 'none',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            '--zoom-scale': scale,
            '--zoom-x': `${position.x}px`,
            '--zoom-y': `${position.y}px`,
            transform: 'translate3d(var(--zoom-x), var(--zoom-y), 0) scale(var(--zoom-scale))',
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
        ref: contentRef,
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