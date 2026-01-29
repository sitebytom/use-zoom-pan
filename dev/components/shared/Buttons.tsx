import React, { useState } from 'react'

export const CopyButton = ({ text, style }: { text: string, style?: React.CSSProperties }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button 
      onClick={handleCopy} 
      className="copy-button"
      style={style}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export const ControlButton = ({ onClick, children, title }: { onClick: () => void, children: React.ReactNode, title?: string }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="control-button"
    title={title}
  >
    <span className="control-btn-inner">{children}</span>
  </button>
)

export const NavButton = ({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`sidebar-nav-item ${active ? 'active' : ''}`}
  >
    <span className="sidebar-nav-item-text">{children}</span>
  </button>
)
