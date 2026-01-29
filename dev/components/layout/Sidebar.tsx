import React from 'react'
import { NavButton, GitHubIcon, LogoIcon } from '../shared'

interface SidebarProps {
  activeTab: string
  setActiveTab: (id: string) => void
  docs: { id: string, label: string }[]
  examples: { id: string, label: string }[]
}

export const Sidebar = ({ activeTab, setActiveTab, docs, examples }: SidebarProps) => {
  return (
    <aside className="sidebar">
      <div 
        className="sidebar-logo" 
        onClick={() => setActiveTab('getting-started')}
        role="button"
        tabIndex={0}
      >
        <LogoIcon />
        <div className="sidebar-title-group">
          <h1 className="sidebar-title">useZoomPan</h1>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-title">Documentation</div>
        {docs.map(tab => (
          <NavButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </NavButton>
        ))}

        <div className="sidebar-nav-title sidebar-section-title">Examples</div>
        {examples.map(tab => (
          <NavButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </NavButton>
        ))}
      </nav>

      <div className="sidebar-footer">
        <a 
            href="https://github.com/sitebytom/use-zoom-pan" 
            target="_blank" 
            rel="noopener noreferrer"
            className="github-link"
        >
            <GitHubIcon />
            <span>GitHub Repository</span>
        </a>
      </div>
    </aside>
  )
}
