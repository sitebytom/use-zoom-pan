import React from 'react'
import { ZoomPan } from '../../../src'

const SimpleImageExample = () => {
  return (
    <div className="viewport-container">
      <ZoomPan options={{ boundsBuffer: 0 }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/image-1.webp`}
          alt="Photography"
          draggable={false}
          className="viewport-image"
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </ZoomPan>
    </div>
  )
}

export default SimpleImageExample

