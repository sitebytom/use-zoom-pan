'use client'

import React, { useRef, CSSProperties } from 'react'
import { useZoomPan } from './useZoomPan'
import { ZoomPanOptions } from './types'

interface ZoomPanProps {
    /** The content to be made zoomable and pannable (e.g., an <img> or <svg>) */
    children: React.ReactNode
    /** Optional CSS class for the wrapper container */
    className?: string
    /** Optional inline styles for the wrapper container */
    style?: CSSProperties
    /** Optional CSS class for the inner content wrapper */
    contentClassName?: string
    /** Optional inline styles for the inner content wrapper */
    contentStyle?: CSSProperties
    /** Whether to enable zoom/pan interactions (default: true) */
    enableZoom?: boolean
    /** Callback triggered when a swipe-left (next) is detected on the container */
    onNext?: () => void
    /** Callback triggered when a swipe-right (prev) is detected on the container */
    onPrev?: () => void
    /** Advanced configuration for zoom sensitivity, bounds, etc. */
    options?: ZoomPanOptions
}

/**
 * A simple component wrapper for zoom and pan functionality.
 * Wrap any content (images, SVG, canvas, etc.) to make it zoomable and pannable.
 * 
 * @example
 * ```tsx
 * <ZoomPan>
 *   <img src="photo.jpg" alt="Zoomable" />
 * </ZoomPan>
 * ```
 * 
 * @example With custom options
 * ```tsx
 * <ZoomPan options={{ maxScale: 6, clickZoomScale: 3 }}>
 *   <canvas ref={canvasRef} />
 * </ZoomPan>
 * ```
 */
export const ZoomPan: React.FC<ZoomPanProps> = ({
    children,
    className = '',
    style = {},
    contentClassName = '',
    contentStyle = {},
    enableZoom = true,
    onNext,
    onPrev,
    options,
}) => {
    const containerRef = useRef<HTMLDivElement>(null)

    const { scale, position, contentProps, containerProps } = useZoomPan<HTMLDivElement>({
        containerRef,
        enableZoom,
        onNext,
        onPrev,
        options,
    })

    const defaultContainerStyle: CSSProperties = {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: scale > 1 ? 'grab' : enableZoom ? 'zoom-in' : 'default',
        position: 'relative',
        ...style,
    }

    const defaultContentStyle: CSSProperties = {
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        maxWidth: '100%',
        maxHeight: '100%',
        ...contentStyle,
    }

    return (
        <div
            ref={containerRef}
            className={className}
            style={defaultContainerStyle}
            {...containerProps}
        >
            <div
                className={contentClassName}
                {...contentProps}
                style={{
                    ...defaultContentStyle,
                    ...contentProps.style,
                }}
            >
                {children}
            </div>
        </div>
    )
}

export default ZoomPan