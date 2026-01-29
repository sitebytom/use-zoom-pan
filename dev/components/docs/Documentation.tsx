import React from 'react'
import GettingStarted from './GettingStarted'
import ApiReference from './ApiReference'
import Interactions from './Interactions'
import Performance from './Performance'

const Documentation = ({ activeSection }: { activeSection: string }) => {
  return (
    <div className="docs-container">
      <div className="docs-main">
        {activeSection === 'getting-started' && <GettingStarted />}
        {activeSection === 'api-reference' && <ApiReference />}
        {activeSection === 'interactions' && <Interactions />}
        {activeSection === 'performance' && <Performance />}
      </div>
    </div>
  )
}

export default Documentation
