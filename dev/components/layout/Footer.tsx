import React from 'react'
import { LogoIcon } from '../shared'

export const Footer = () => {
  return (
    <div className="app-footer">
      <div className="footer-left">
        <LogoIcon size={24} />
        <span className="footer-logo-text">useZoomPan</span>
        <span className="footer-separator">|</span>
        <span className="footer-credit">@sitebytom</span>
      </div>
      <a href="https://github.com/sitebytom/use-zoom-pan" target="_blank" rel="noopener noreferrer" className="footer-link">
        Open Source on GitHub
      </a>
    </div>
  )
}
