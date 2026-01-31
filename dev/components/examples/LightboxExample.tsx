import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useZoomPan } from '../../../src'
import { ControlButton } from '../shared'

const images = [
  { id: 1, url: `${import.meta.env.BASE_URL}assets/image-1.webp`, alt: 'Mountain landscape' },
  { id: 2, url: `${import.meta.env.BASE_URL}assets/image-2.webp`, alt: 'Glacier view' },
  { id: 3, url: `${import.meta.env.BASE_URL}assets/image-3.webp`, alt: 'Reindeer grazing' },
  { id: 4, url: `${import.meta.env.BASE_URL}assets/image-4.webp`, alt: 'Coastal view' },
  { id: 5, url: `${import.meta.env.BASE_URL}assets/image-5.webp`, alt: 'Road to mines' },
]

const LightboxExample = () => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div className="viewport-container" style={{ background: 'var(--bg)' }}>
      {/* Thumbnail Grid */}
      <div className="lightbox-grid">
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => openLightbox(i)}
            className="lightbox-grid__item"
          >
            <img
              src={img.url}
              alt={img.alt}
              draggable={false}
            />
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <Lightbox
          images={images}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}

const Lightbox = ({
  images,
  currentIndex,
  setCurrentIndex,
  onClose,
}: {
  images: Array<{ id: number; url: string; alt: string }>
  currentIndex: number
  setCurrentIndex: (index: number) => void
  onClose: () => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(true)
  const [isChangingImage, setIsChangingImage] = useState(false)

  const { contentProps, containerProps, reset } = useZoomPan({
    containerRef,
    enableZoom: true,
    onNext: () => handleNext(),
    onPrev: () => handlePrev(),
    options: { boundsBuffer: 0 },
  })

  const currentImage = images[currentIndex]

  const handleNext = useCallback(() => {
    setIsChangingImage(true)
    setCurrentIndex((currentIndex + 1) % images.length)
    setTimeout(() => setIsChangingImage(false), 0)
  }, [currentIndex, images.length, setCurrentIndex])

  const handlePrev = useCallback(() => {
    setIsChangingImage(true)
    setCurrentIndex((currentIndex - 1 + images.length) % images.length)
    setTimeout(() => setIsChangingImage(false), 0)
  }, [currentIndex, images.length, setCurrentIndex])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 300)
  }, [onClose])

  // Reset zoom when image changes (instant, no transition)
  useEffect(() => {
    reset()
  }, [currentIndex, reset])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleClose()
          break
        case 'ArrowRight':
          handleNext()
          break
        case 'ArrowLeft':
          handlePrev()
          break
        case 'g':
          setShowThumbnails(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, handleNext, handlePrev])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className={`lightbox ${isClosing ? 'lightbox--closing' : ''}`}>
      {/* Header */}
      <div className="lightbox__header">
        <div className="lightbox__counter">
          {currentIndex + 1} / {images.length}
        </div>
        <div className="lightbox__controls">
          <ControlButton
            onClick={() => setShowThumbnails(!showThumbnails)}
            title="Toggle thumbnails (G)"
          >
            ⊞
          </ControlButton>
          <ControlButton
            onClick={handleClose}
            title="Close (ESC)"
          >
            ✕
          </ControlButton>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        {...containerProps}
        className="lightbox__container"
      >
        {/* Navigation Buttons */}
        <button
          onClick={handlePrev}
          className="lightbox__nav-btn lightbox__nav-btn--prev"
          aria-label="Previous image"
        >
          ←
        </button>
        <button
          onClick={handleNext}
          className="lightbox__nav-btn lightbox__nav-btn--next"
          aria-label="Next image"
        >
          →
        </button>

        {/* Image */}
        <img
          key={currentImage.id}
          src={currentImage.url}
          alt={currentImage.alt}
          {...contentProps}
          draggable={false}
          className={`lightbox__image ${isChangingImage ? 'lightbox__image--no-transition' : ''}`}
          style={{
            ...contentProps.style,
          }}
        />
      </div>

      {/* Footer Info */}
      <div className="lightbox__footer">
        {currentImage.alt}
      </div>

      {/* Thumbnails */}
      {showThumbnails && (
        <div className="lightbox__thumbnails">
          {images.map((img: typeof images[0], i: number) => (
            <button
              key={img.id}
              onClick={() => setCurrentIndex(i)}
              className={`lightbox__thumbnail ${i === currentIndex ? 'lightbox__thumbnail--active' : ''}`}
            >
              <img
                src={img.url}
                alt={img.alt}
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LightboxExample
