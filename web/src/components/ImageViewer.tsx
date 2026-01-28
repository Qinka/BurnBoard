import { useEffect, useRef, useState, useCallback } from 'react';

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  step: number;
  tag: string;
  run: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  isOpen,
  onClose,
  imageSrc,
  imageAlt,
  imageWidth,
  imageHeight,
  step,
  tag,
  run,
}) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => {
      const newZoom = Math.max(0.1, Math.min(10, prev + delta * prev));
      return newZoom;
    });
  }, []);

  // Drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Download image
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `${tag.replace(/\//g, '_')}_${run}_step${step}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageSrc, tag, run, step]);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Fit to screen
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 100;
    const containerHeight = containerRef.current.clientHeight - 150;
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const fitScale = Math.min(scaleX, scaleY, 1);
    setZoom(fitScale);
    setPosition({ x: 0, y: 0 });
  }, [imageWidth, imageHeight]);

  if (!isOpen) return null;

  return (
    <div 
      className="image-viewer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      ref={containerRef}
    >
      <div className="image-viewer-container">
        <div className="image-viewer-header">
          <div className="image-viewer-info">
            <span className="image-viewer-tag">{tag}</span>
            <span className="image-viewer-run">{run}</span>
            <span className="image-viewer-step">Step: {step}</span>
            <span className="image-viewer-size">{imageWidth}×{imageHeight}</span>
          </div>
          <div className="image-viewer-controls">
            <span className="image-viewer-zoom-label">Zoom: {Math.round(zoom * 100)}%</span>
            <button 
              className="image-viewer-btn"
              onClick={handleFitToScreen}
              title="Fit to screen"
            >
              ⊡
            </button>
            <button 
              className="image-viewer-btn"
              onClick={handleResetZoom}
              title="Reset zoom (100%)"
            >
              1:1
            </button>
            <button 
              className="image-viewer-btn"
              onClick={() => setZoom(z => Math.min(10, z * 1.5))}
              title="Zoom in"
            >
              +
            </button>
            <button 
              className="image-viewer-btn"
              onClick={() => setZoom(z => Math.max(0.1, z / 1.5))}
              title="Zoom out"
            >
              −
            </button>
            <button 
              className="image-viewer-btn image-viewer-download-btn"
              onClick={handleDownload}
              title="Download image"
            >
              ⬇
            </button>
            <button 
              className="image-viewer-btn image-viewer-close-btn"
              onClick={onClose}
              title="Close (ESC)"
            >
              ✕
            </button>
          </div>
        </div>
        <div 
          className="image-viewer-content"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt={imageAlt}
            className="image-viewer-image"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              imageRendering: zoom > 1 ? 'pixelated' : 'auto',
            }}
            draggable={false}
          />
        </div>
        <div className="image-viewer-footer">
          <span>Scroll to zoom • Drag to pan • Click outside or press ESC to close</span>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;
