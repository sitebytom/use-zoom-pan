import React, { useState } from 'react'
import { CopyButton } from './Buttons'

export const Panel = ({ title, preview, code, description, className, extra }: { title: string, preview: React.ReactNode, code: string, description?: string, className?: string, extra?: React.ReactNode }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview')

  return (
    <div className="panel-wrapper">
      <div className="example-header">
        <div className="example-header-top">
          <div className="panel-header-info">
            <h2 className="example-title">{title}</h2>
            {description && <p className="example-description panel-description-text">{description}</p>}
          </div>
          
          <div className="tabs-header">
            <div className="panel-tabs-wrapper">
              <button 
                onClick={() => setActiveTab('preview')}
                className={`tab-button panel-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              >
                Preview
              </button>
              <button 
                onClick={() => setActiveTab('code')}
                className={`tab-button panel-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
              >
                Source
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`panel-content ${className || ''}`}>
        <div className="panel-preview-container" style={{ 
          display: activeTab === 'preview' ? 'flex' : 'none'
        }}>
          {preview}
        </div>
        <div 
          className="code-preview panel-code-container" 
          style={{ 
            display: activeTab === 'code' ? 'block' : 'none'
          }}
        >
          <div className="panel-copy-wrapper">
            <CopyButton text={code} />
          </div>
          <pre className="panel-code-pre">
            <code className="panel-code-text">{code}</code>
          </pre>
        </div>
      </div>

      {extra && activeTab === 'preview' && (
        <div className="panel-extra panel-extra-container">
          {extra}
        </div>
      )}
    </div>
  )
}
