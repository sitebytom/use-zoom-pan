import React, { useState } from 'react'
import { ZoomPan } from '../../../src'

const GalleryExample = () => {
    const images = [
      `${import.meta.env.BASE_URL}assets/image-4.webp`,
      `${import.meta.env.BASE_URL}assets/image-5.webp`,
      `${import.meta.env.BASE_URL}assets/image-3.webp`
    ]
    const [currentIndex, setCurrentIndex] = useState(0)
    
    const navigate = (dir: number) => {
      setCurrentIndex((i) => (i + dir + images.length) % images.length)
    }
  
    return (
      <div className="viewport-container aspect-16-10">
          <ZoomPan key={currentIndex} onNext={() => navigate(1)} onPrev={() => navigate(-1)}>
              <img src={images[currentIndex]} alt="Gallery" draggable={false} className="viewport-image" style={{ objectFit: 'cover' }} />
          </ZoomPan>
          
          <div style={{ position: 'absolute', inset: '0', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(-1); }} 
                className="control-button" 
                style={{ pointerEvents: 'auto', borderRadius: '50%' }}
              >
                ←
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(1); }} 
                className="control-button" 
                style={{ pointerEvents: 'auto', borderRadius: '50%' }}
              >
                →
              </button>
          </div>
          
          <div className="selected-badge" style={{ 
            top: 'auto',
            bottom: '20px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
          }}>
              {currentIndex + 1} / {images.length}
          </div>
      </div>
    )
}

export default GalleryExample
