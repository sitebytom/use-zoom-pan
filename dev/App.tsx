import React, { useState, useEffect } from 'react'
import './index.scss'

// Shared UI Components
import { Panel, NavButton, GitHubIcon, LogoIcon } from './components/shared'

// Layout Components
import { Sidebar } from './components/layout/Sidebar'
import { Footer } from './components/layout/Footer'

// Examples & Raw Source
import SimpleImageExample from './components/examples/SimpleImageExample'
import simpleImageCode from './components/examples/SimpleImageExample?raw'

import CustomHookExample from './components/examples/CustomHookExample'
import { DEFAULT_PLAYGROUND_OPTIONS } from './components/examples/constants'
import customHookCode from './components/examples/CustomHookExample?raw'

import GalleryExample from './components/examples/GalleryExample'
import galleryCode from './components/examples/GalleryExample?raw'

import InteractivePinsExample from './components/examples/InteractivePinsExample'
import interactivePinsCode from './components/examples/InteractivePinsExample?raw'

import BlueprintExample from './components/examples/BlueprintExample'
import blueprintCode from './components/examples/BlueprintExample?raw'

import CustomContentExample from './components/examples/CustomContentExample'
import customContentCode from './components/examples/CustomContentExample?raw'

import Documentation from './components/docs/Documentation'

// Main App Layout
export default function App() {
  const [activeTab, setActiveTab] = useState('getting-started')
  const [playgroundOptions, setPlaygroundOptions] = useState(DEFAULT_PLAYGROUND_OPTIONS)

  const examples = [
    { id: 'simple', label: 'Simple Component', component: <Panel title="Basic Image Viewing" className="aspect-16-10" description="The most common use-case. Seamlessly add zoom-and-pan to any standard image using the high-level ZoomPan component." code={simpleImageCode} preview={<SimpleImageExample />} /> },
    { id: 'hook', label: 'Hook & Playground', component: <Panel title="Lower-level Hook Usage" description="Full control over the zoom-and-pan state. Use this approach when you need to integrate the core primitives into your own custom UI or layouts." code={customHookCode} preview={<CustomHookExample mode="viewport" options={playgroundOptions} onReset={() => setPlaygroundOptions(DEFAULT_PLAYGROUND_OPTIONS)} setOptions={setPlaygroundOptions} />} extra={<CustomHookExample mode="controls" options={playgroundOptions} setOptions={setPlaygroundOptions} onReset={() => {}} />} /> },
    { id: 'gallery', label: 'Gallery & Swipe', component: <Panel title="Image Gallery" className="aspect-16-10" description="Touch-friendly navigation for multi-image interfaces. Supports both swipe-to-navigate and pinch-to-zoom for a native mobile feel." code={galleryCode} preview={<GalleryExample />} /> },
    { id: 'pins', label: 'Interactive Pins', component: <Panel title="Interactive Pins" className="aspect-16-10" description="Coordinate-based annotations. Demonstrates how to pin markers to specific points on an image that stay fixed as you zoom and pan." code={interactivePinsCode} preview={<InteractivePinsExample />} /> },
    { id: 'svg', label: 'Mechanical Blueprint', component: <Panel title="Mechanical Blueprint" className="aspect-16-10" description="Technical drawing visualization. High-performance rendering of complex SVG assets with precision zooming for reading fine details." code={blueprintCode} preview={<BlueprintExample />} /> },
    { id: 'content', label: 'Rich Content', component: <Panel title="HTML Content Zoom" className="aspect-16-10" description="Generalized zoom-and-pan logic. Demonstrates that you can scale arbitrary HTML content e.g. text, layouts, and sub-elements not just media." code={customContentCode} preview={<CustomContentExample />} /> },
  ]

  const docs = [
    { id: 'getting-started', label: 'Quick Start', component: <Documentation activeSection="getting-started" /> },
    { id: 'api-reference', label: 'API Reference', component: <Documentation activeSection="api-reference" /> },
    { id: 'interactions', label: 'Gestures & Controls', component: <Documentation activeSection="interactions" /> },
    { id: 'performance', label: 'Performance', component: <Documentation activeSection="performance" /> },
  ]

  const tabs = [...docs, ...examples]

  // Sync state with hash on mount and when hash changes
  useEffect(() => {
    const syncWithHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash && tabs.some(t => t.id === hash)) {
        setActiveTab(hash)
      } else if (!hash) {
        // Default to getting-started if no hash
        window.location.hash = 'getting-started'
      }
    }

    syncWithHash()
    window.addEventListener('hashchange', syncWithHash)
    return () => window.removeEventListener('hashchange', syncWithHash)
  }, [])

  const handleTabChange = (id: string) => {
    window.location.hash = id
  }

  return (
    <div className="app-container">
      {/* Sidebar - Desktop */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        docs={docs} 
        examples={examples} 
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="mobile-nav">
           <h1 className="mobile-title">useZoomPan</h1>
           <select 
             value={activeTab} 
             onChange={(e) => handleTabChange(e.target.value)}
             className="tab-select"
           >
             {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
           </select>
        </div>

        <div className="content-inner">
          <div key={activeTab}>
            {tabs.find(t => t.id === activeTab)?.component}
          </div>

          <Footer />
        </div>
      </main>

    </div>
  )
}
