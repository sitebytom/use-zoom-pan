'use client'

import React, { useRef, CSSProperties } from 'react'
import { useZoomPan, ZoomPanOptions } from './useZoomPan'

interface ZoomPanProps {
    children: React.ReactNode
    className?: string
    style?: CSSProperties
    contentClassName?: string
    contentStyle?: CSSProperties
    enableZoom?: boolean
    onNext?: () => void
    onPrev?: () => void
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

    const { scale, position, contentProps, containerProps } = useZoomPan({
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
        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        ...contentProps.style,
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