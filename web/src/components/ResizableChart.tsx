import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizableChartProps {
  children: (height: number) => React.ReactNode;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  tag: string;
}

const ResizableChart: React.FC<ResizableChartProps> = ({
  children,
  defaultHeight = 250,
  minHeight = 100,
  maxHeight = 600,
  tag,
}) => {
  const [height, setHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const isResizingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaY = e.clientY - startY.current;
      const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [minHeight, maxHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHeight(defaultHeight);
  }, [defaultHeight]);

  return (
    <div className="resizable-chart-wrapper">
      <div className="resizable-chart-content">
        {children(height)}
      </div>
      <div 
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title={`Drag to resize chart "${tag}" (double-click to reset)`}
        role="slider"
        aria-label={`Resize chart ${tag}`}
        aria-valuenow={height}
        aria-valuemin={minHeight}
        aria-valuemax={maxHeight}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHeight(prev => Math.max(minHeight, prev - 20));
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHeight(prev => Math.min(maxHeight, prev + 20));
          } else if (e.key === 'Home') {
            e.preventDefault();
            setHeight(minHeight);
          } else if (e.key === 'End') {
            e.preventDefault();
            setHeight(maxHeight);
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setHeight(defaultHeight);
          }
        }}
      >
        <div className="resize-handle-icon">
          <span>⋯</span>
        </div>
        <span className="resize-handle-hint">{Math.round(height)}px</span>
      </div>
    </div>
  );
};

export default ResizableChart;
