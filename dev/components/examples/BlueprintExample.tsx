import React, { useRef, useState, useEffect } from 'react'
import { useZoomPan } from '../../../src'

const BlueprintExample = () => {
    const containerRef = useRef<HTMLDivElement>(null)
    const { scale, position, contentProps, zoomTo } = useZoomPan({
        containerRef,
        enableZoom: true,
        options: { 
            maxScale: 12, 
            minScale: 0.6, 
            initialScale: 2,
            initialPosition: { x: 0, y: 0 } 
        }
    })

    // Animation State
    const [angle, setAngle] = useState(0)
    
    // Animation Loop: Zoom In = Power Up (Faster), Zoom Out = Power Down (Stop)
    useEffect(() => {
        let frameId: number
        const animate = () => {
            const speed = Math.max(0, (scale - 0.9) * 0.3)
            if (speed > 0) {
                setAngle(a => a + speed)
            }
            frameId = requestAnimationFrame(animate)
        }
        frameId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(frameId)
    }, [scale]) 

    // Dynamic stroke widths for "non-scaling" technical lines
    const bridgeW = 2 / scale
    const traceW = 1.2 / scale 
    const hairW = 0.8 / scale 

    // Gear Path Generator
    const createGearPath = (cx: number, cy: number, r: number, teeth: number, depth: number) => {
        let d = ""
        const step = (Math.PI * 2) / teeth
        const toothWidth = step * 0.4 
        const taper = step * 0.1

        for (let i = 0; i < teeth; i++) {
            const angle = i * step
            const bs = angle - toothWidth/2
            const ts = angle - toothWidth/2 + taper
            const te = angle + toothWidth/2 - taper
            const be = angle + toothWidth/2
            const rBase = r - depth
            const rTip = r

            const x0 = cx + Math.cos(bs) * rBase
            const y0 = cy + Math.sin(bs) * rBase
            const x1 = cx + Math.cos(ts) * rTip
            const y1 = cy + Math.sin(ts) * rTip
            const x2 = cx + Math.cos(te) * rTip
            const y2 = cy + Math.sin(te) * rTip
            const x3 = cx + Math.cos(be) * rBase
            const y3 = cy + Math.sin(be) * rBase

            if (i === 0) d += `M ${x0} ${y0}`
            else d += ` L ${x0} ${y0}`
            d += ` L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`
        }
        return d + " Z"
    }

    // Interactive zoom handler
    const handleZoomTo = (e: React.MouseEvent, x: number, y: number, z: number = 2) => {
        e.stopPropagation()
        zoomTo(x, y, z)
    }

    return (
        <div ref={containerRef} className="viewport-container">
            <div 
                {...contentProps}
                className="viewport-canvas"
                style={{ 
                    ...contentProps.style,
                    width: '1280px',
                    height: '800px',
                    pointerEvents: 'auto',
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
                    willChange: 'transform', 
                    fontFamily: 'var(--font-mono)',
                }}
            >
                <svg 
                    viewBox="0 0 1280 800" 
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'block',
                        background: 'var(--bg)', 
                        pointerEvents: 'none',
                        overflow: 'visible'
                    }}
                >
                    <defs>
                        <pattern id="subgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" strokeWidth={traceW * 0.5} opacity="0.5"/>
                        </pattern>
                        <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--text)" strokeWidth={hairW} opacity="0.2" />
                        </pattern>
                    </defs>

                    {/* Background Grid */}
                    <rect width="1280" height="800" fill="url(#subgrid)" />
                    
                    {/* Border Frame */}
                    <rect x="20" y="20" width="1240" height="760" fill="none" stroke="var(--border-bright)" strokeWidth={bridgeW * 2} />
                    <rect x="30" y="30" width="1220" height="740" fill="none" stroke="var(--border-bright)" strokeWidth={traceW} />

                    {/* CENTER: PLANETARY GEARBOX */}
                    <g transform="translate(640, 400)" onClick={(e) => handleZoomTo(e, 640, 400)}>
                        {/* Center Lines */}
                        <line x1="-220" y1="0" x2="220" y2="0" stroke="#fff" strokeWidth={hairW} strokeDasharray="10 5 2 5" />
                        <line x1="0" y1="-220" x2="0" y2="220" stroke="#fff" strokeWidth={hairW} strokeDasharray="10 5 2 5" />

                        {/* Main Ring Gear Housing */}
                        <circle r="200" fill="none" stroke="#fff" strokeWidth={bridgeW} />
                        <circle r="190" fill="none" stroke="#fff" strokeWidth={traceW} />
                        {/* Cutaway Section for Hatching */}
                        <path d="M 190 0 A 190 190 0 0 0 0 190 L 0 200 A 200 200 0 0 1 200 0 Z" fill="url(#hatch)" stroke="none" />
                        
                        {/* sun Gear (Center) - ROTATING */}
                        <g transform={`rotate(${angle})`}>
                            <path d={createGearPath(0, 0, 85, 24, 15)} fill="none" stroke="var(--text)" strokeWidth={bridgeW} />
                            <circle r="20" fill="none" stroke="var(--text)" strokeWidth={traceW} />
                            <path d="M -20 -5 L -20 5 L -5 5 L -5 -5 Z" fill="none" stroke="var(--text)" strokeWidth={hairW} /> {/* Keyway */}
                        </g>

                        {/* Planetary Gears (3x) - ROTATING */}
                        {[0, 120, 240].map((baseAngle, i) => (
                            <g key={i} transform={`rotate(${baseAngle}) translate(135, 0)`}>
                                <g transform={`rotate(${angle * -1.33 + 10})`}>
                                    <path d={createGearPath(0, 0, 60, 18, 10)} fill="var(--surface-1)" stroke="var(--text)" strokeWidth={traceW} />
                                    <circle r="15" fill="none" stroke="var(--text)" strokeWidth={traceW} />
                                </g>
                                <g style={{ opacity: Math.max(0, scale - 2) }}>
                                     {/* Bearing details */}
                                    <circle r="10" fill="none" stroke="var(--text)" strokeWidth={hairW} strokeDasharray="2 2" />
                                    {Array.from({ length: 8 }).map((_, j) => (
                                        <circle key={j} cx={Math.cos(j*Math.PI/4)*12} cy={Math.sin(j*Math.PI/4)*12} r="1" fill="var(--text)" />
                                    ))}
                                </g>
                            </g>
                        ))}

                        {/* Label */}
                        <text x="160" y="-160" fill="var(--text-dim)" fontSize="14" fontWeight="600">SEC A-A</text>
                    </g>

                    {/* TOP LEFT: HYDRAULIC PUMP */}
                    <g transform="translate(280, 250)" onClick={(e) => handleZoomTo(e, 280, 250, 6)}>
                        {/* Pump Body */}
                        <rect x="-60" y="-80" width="120" height="160" rx="2" fill="var(--surface-1)" stroke="var(--text)" strokeWidth={bridgeW} />
                        {/* Mounting Flanges */}
                        <rect x="-80" y="-70" width="20" height="40" fill="url(#hatch)" stroke="var(--text)" strokeWidth={traceW} />
                        <rect x="60" y="-70" width="20" height="40" fill="url(#hatch)" stroke="var(--text)" strokeWidth={traceW} />
                        
                        {/* Internal Schematic Symbol (Pump) */}
                        <circle cx="0" cy="0" r="40" fill="none" stroke="var(--text)" strokeWidth={traceW} />
                        <g transform={`rotate(${angle * 2})`}>
                            <path d="M -30 15 L 0 -35 L 30 15 Z" fill="none" stroke="var(--text)" strokeWidth={traceW} />
                        </g>
                        
                        {/* Pipe Connections */}
                        <path d="M 0 -80 L 0 -120 M -10 -120 L 10 -120" stroke="var(--text)" strokeWidth={traceW} />
                        <path d="M 0 80 L 0 120 M -10 120 L 10 120" stroke="var(--text)" strokeWidth={traceW} />

                        <text x="0" y="100" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="700">HYD-PUMP-01</text>
                        
                        {/* Micro Details (Bolts) */}
                        <g style={{ opacity: Math.max(0, scale - 3) }}>
                            <circle cx="-70" cy="-60" r="3" fill="none" stroke="var(--text)" strokeWidth={hairW} />
                            <circle cx="-70" cy="-40" r="3" fill="none" stroke="var(--text)" strokeWidth={hairW} />
                            <circle cx="70" cy="-60" r="3" fill="none" stroke="var(--text)" strokeWidth={hairW} />
                            <circle cx="70" cy="-40" r="3" fill="none" stroke="var(--text)" strokeWidth={hairW} />
                        </g>
                    </g>

                    {/* CONNECTION LINES (Piping) with Flow Indicators */}
                    <g>
                        <path d="M 340 250 L 490 250 L 490 400 L 460 400" fill="none" stroke="var(--text)" strokeWidth={traceW} />
                        <path d="M 940 600 L 820 600 L 820 400 L 790 400" fill="none" stroke="var(--text)" strokeWidth={traceW} />
                        
                        {/* Flow Arrows (Animated) */}
                        <circle cx={415 + Math.sin(angle * 0.1) * 10} cy="250" r="2" fill="var(--text)" />
                        <circle cx="490" cy={325 + Math.sin(angle * 0.1) * 20} r="2" fill="var(--text)" />
                        <circle cx="820" cy={500 + Math.cos(angle * 0.1) * 20} r="2" fill="var(--text)" />
                    </g>

                    {/* BOTTOM RIGHT: RESERVOIR/FILTER */}
                    <g transform="translate(1000, 600)" onClick={(e) => handleZoomTo(e, 1000, 600, 5)}>
                        {/* Cylindrical Tank Symbol */}
                        <ellipse cx="0" cy="-60" rx="60" ry="15" fill="none" stroke="var(--text)" strokeWidth={traceW} />
                        <path d="M -60 -60 L -60 60 A 60 15 0 0 0 60 60 L 60 -60" fill="none" stroke="var(--text)" strokeWidth={bridgeW} />
                        {/* Bottom Curve */}
                        <path d="M -60 60 A 60 15 0 0 1 60 60" fill="none" stroke="var(--text)" strokeWidth={traceW} strokeDasharray="4 2" />
                        
                        {/* Fluid Level Marker - Animated */}
                        <line x1="70" y1="0" x2="80" y2="0" stroke="var(--text)" strokeWidth={traceW} />
                        <path d={`M 75 ${Math.sin(angle * 0.2)*2} L 75 20 L 85 20`} fill="none" stroke="var(--text)" strokeWidth={hairW} />
                        <text x="90" y="25" fill="var(--text-dim)" fontSize="10">LVL</text>

                        {/* Filter Element Internal */}
                        <rect x="-30" y="-40" width="60" height="80" fill="none" stroke="var(--text)" strokeWidth={hairW} strokeDasharray="5 5" />
                        
                        <text x="0" y="90" textAnchor="middle" fill="var(--text)" fontSize="12" fontWeight="700">RSV-MAIN</text>
                    </g>

                     {/* Title Block */}
                     <g transform="translate(1000, 700)">
                        <rect x="0" y="0" width="260" height="80" fill="none" stroke="var(--text)" strokeWidth={bridgeW} />
                        <path d="M 130 0 L 130 80 M 0 40 L 260 40" stroke="var(--text)" strokeWidth={traceW} />
                        <text x="10" y="25" fill="var(--text-muted)" fontSize="10" fontWeight="700">PROJECT NO.</text>
                        <text x="70" y="25" fill="var(--text)" fontSize="12" fontWeight="900">99-X-INDUSTRIAL</text>
                        <text x="10" y="65" fill="var(--text-muted)" fontSize="10" fontWeight="700">SHEET</text>
                        <text x="70" y="65" fill="var(--text)" fontSize="12" fontWeight="900">04 / 12</text>
                        <text x="140" y="25" fill="var(--text-muted)" fontSize="10" fontWeight="700">REV</text>
                        <text x="200" y="25" fill="var(--text)" fontSize="12" fontWeight="900">C.0</text>
                        <text x="140" y="65" fill="var(--text-muted)" fontSize="10" fontWeight="700">STATUS</text>
                        <text x="200" y="65" fill="var(--text)" fontSize="12" fontWeight="900">FINAL</text>
                    </g>
                </svg>
            </div>
        </div>
    )
}

export default BlueprintExample
