import React, { useState } from 'react'
import { CopyButton } from './Buttons'

export const Section = ({ title, children, id }: { title: string, children: React.ReactNode, id: string }) => (
  <section id={id} className="docs-section">
    <h2 className="docs-section-title">{title}</h2>
    <div className="docs-section-content">{children}</div>
  </section>
)

export const CodeBlock = ({ code, language = 'tsx' }: { code: string, language?: string }) => (
  <div className="docs-code-container">
    <div className="docs-code-header">
      <span className="docs-code-lang">{language.toUpperCase()}</span>
      <CopyButton text={code} />
    </div>
    <pre className="docs-pre">
      <code className="docs-code">{code}</code>
    </pre>
  </div>
)

export const Table = ({ headers, rows }: { headers: string[], rows: (string | React.ReactNode)[][] }) => (
  <div className="docs-table-wrapper">
    <table className="docs-table">
      <thead>
        <tr>
          {headers.map(h => <th key={h}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const PackageManagerTabs = () => {
  const [activePkg, setActivePkg] = useState('pnpm')
  
  const commands: Record<string, string> = {
    pnpm: 'pnpm add @sitebytom/use-zoom-pan',
    npm: 'npm install @sitebytom/use-zoom-pan',
    yarn: 'yarn add @sitebytom/use-zoom-pan'
  }

  return (
    <div className="pkg-tabs-container">
      <div className="pkg-tabs-header">
        <div className="pkg-tabs-switcher">
          {Object.keys(commands).map(pkg => (
            <button 
              key={pkg}
              onClick={() => setActivePkg(pkg)}
              className={`pkg-tab-btn ${activePkg === pkg ? 'active' : ''}`}
            >
              {pkg}
            </button>
          ))}
        </div>
        <CopyButton text={commands[activePkg]} />
      </div>
      <pre className="docs-pre docs-pre-install">
        <code className="docs-code"><span className="pkg-command-prefix">$</span>{commands[activePkg]}</code>
      </pre>
    </div>
  )
}
