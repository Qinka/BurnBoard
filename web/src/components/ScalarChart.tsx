import { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ScalarData {
  tag: string;
  step: number;
  wall_time: number;
  value: number;
}

interface ScalarApiResponse {
  data: ScalarData[];
}

interface SingleTagChartData {
  step: number;
  wall_time: number;
  relative_time: number;
  value: number;        // Transformed value for display
  smoothed: number;     // Smoothed and transformed value
  original: number;     // Transformed original value (for original line display)
  rawValue: number;     // Raw untransformed value (for statistics)
}

export interface ScalarChartHandle {
  refresh: () => void;
}

// Horizontal axis types
type XAxisType = 'step' | 'relative_time' | 'wall_time';

// Y-axis scale types
type YScaleType = 'linear' | 'log';

// Unified color for all metrics
const CHART_COLOR = '#1f77b4'; // blue
const SMOOTHED_COLOR = '#1f77b4'; // blue for smoothed line
const ORIGINAL_COLOR = '#aec7e8'; // light blue for original data

// Apply exponential moving average (EMA) smoothing like TensorBoard
const applySmoothing = (data: SingleTagChartData[], smoothingFactor: number): SingleTagChartData[] => {
  if (smoothingFactor === 0 || data.length === 0) {
    return data.map(d => ({ ...d, smoothed: d.value }));
  }
  
  const smoothed: SingleTagChartData[] = [];
  let lastSmoothed = data[0].value;
  
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    // EMA formula: smoothed = factor * previous + (1 - factor) * current
    const currentSmoothed = smoothingFactor * lastSmoothed + (1 - smoothingFactor) * point.value;
    smoothed.push({
      ...point,
      smoothed: currentSmoothed,
      original: point.value,  // Keep the transformed value for the original line
    });
    lastSmoothed = currentSmoothed;
  }
  
  return smoothed;
};

// Apply Y-axis transformation
const applyTransform = (value: number, scaleType: YScaleType): number | null => {
  if (scaleType === 'log') {
    // Handle zero and negative values for log scale - return null to indicate invalid
    if (value <= 0) return null;
    return Math.log10(value);
  }
  return value;
};

// Format X-axis label based on type
const formatXAxisLabel = (xAxisType: XAxisType): string => {
  switch (xAxisType) {
    case 'step':
      return 'Step';
    case 'relative_time':
      return 'Relative Time (s)';
    case 'wall_time':
      return 'Wall Time';
    default:
      return 'Step';
  }
};

// Format X-axis tick values
const formatXAxisTick = (value: number, xAxisType: XAxisType): string => {
  if (xAxisType === 'wall_time') {
    const date = new Date(value * 1000);
    return date.toLocaleTimeString();
  }
  if (xAxisType === 'relative_time') {
    return `${value.toFixed(1)}s`;
  }
  return String(value);
};

// Format Y-axis label based on scale type
const formatYAxisLabel = (scaleType: YScaleType): string => {
  if (scaleType === 'log') {
    return 'Value (log₁₀)';
  }
  return 'Value';
};

const ScalarChart = forwardRef<ScalarChartHandle>(function ScalarChart(_props, ref) {
  const [data, setData] = useState<ScalarData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Visualization settings
  const [smoothing, setSmoothing] = useState(0.6);
  const [xAxisType, setXAxisType] = useState<XAxisType>('step');
  const [yScaleType, setYScaleType] = useState<YScaleType>('linear');
  const [showOriginal, setShowOriginal] = useState(true);
  
  // Refs for SVG export
  const chartRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const fetchScalars = useCallback(async () => {
    try {
      const response = await fetch('/api/scalars');
      if (!response.ok) {
        throw new Error('Failed to fetch scalars');
      }
      const result: ScalarApiResponse = await response.json();
      
      // Extract unique tags and sort alphabetically
      const uniqueTags = [...new Set(result.data.map(item => item.tag))].sort();
      setTags(uniqueTags);
      
      setData(result.data);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScalars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchScalars
  }), [fetchScalars]);

  const toggleCollapse = (tag: string) => {
    setCollapsedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  // Get chart data for a specific tag
  const getChartDataForTag = (tag: string): SingleTagChartData[] => {
    const tagData = data
      .filter(item => item.tag === tag)
      .sort((a, b) => a.step - b.step);
    
    if (tagData.length === 0) return [];
    
    const firstWallTime = tagData[0].wall_time;
    
    // First pass: create base data with raw values, filtering out invalid values for log scale
    const baseData = tagData
      .map(item => {
        const transformedValue = applyTransform(item.value, yScaleType);
        // Skip invalid log values (null means invalid - zero or negative in log scale)
        if (transformedValue === null) return null;
        return {
          step: item.step,
          wall_time: item.wall_time,
          relative_time: item.wall_time - firstWallTime,
          value: transformedValue,
          smoothed: transformedValue,
          original: transformedValue,
          rawValue: item.value,  // Keep untransformed value for statistics
        };
      })
      .filter((item): item is SingleTagChartData => item !== null);
    
    return applySmoothing(baseData, smoothing);
  };

  // Get X-axis data key based on selected type
  const getXDataKey = (): string => {
    switch (xAxisType) {
      case 'step':
        return 'step';
      case 'relative_time':
        return 'relative_time';
      case 'wall_time':
        return 'wall_time';
      default:
        return 'step';
    }
  };

  // Export chart as SVG
  const exportChartAsSVG = (tag: string) => {
    const chartContainer = chartRefs.current.get(tag);
    if (!chartContainer) return;
    
    const svgElement = chartContainer.querySelector('svg');
    if (!svgElement) return;
    
    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    
    // Add proper namespace and styling for standalone SVG
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    
    // Add title element for chart title
    const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleElement.textContent = tag;
    clonedSvg.insertBefore(titleElement, clonedSvg.firstChild);
    
    // Add metadata with editable information
    const descElement = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
    descElement.textContent = JSON.stringify({
      title: tag,
      xAxis: formatXAxisLabel(xAxisType),
      yAxis: formatYAxisLabel(yScaleType),
      smoothing: smoothing,
      exportedAt: new Date().toISOString(),
    });
    clonedSvg.insertBefore(descElement, clonedSvg.firstChild);
    
    // Add white background for better paper compatibility
    const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    backgroundRect.setAttribute('width', '100%');
    backgroundRect.setAttribute('height', '100%');
    backgroundRect.setAttribute('fill', 'white');
    clonedSvg.insertBefore(backgroundRect, clonedSvg.firstChild);
    
    // Style text elements for better readability in papers
    const textElements = clonedSvg.querySelectorAll('text');
    textElements.forEach(text => {
      text.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
      if (!text.getAttribute('fill') || text.getAttribute('fill') === 'rgba(255, 255, 255, 0.87)') {
        text.setAttribute('fill', '#333');
      }
    });
    
    // Convert to blob and download
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tag.replace(/\//g, '_')}_chart.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="loading">Loading scalar data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2>Scalar Values</h2>
      </div>
      
      {/* Global visualization controls */}
      <div className="visualization-controls">
        <div className="control-group">
          <label className="control-label">
            Smoothing: {smoothing.toFixed(2)}
            <input
              type="range"
              min="0"
              max="0.99"
              step="0.01"
              value={smoothing}
              onChange={(e) => setSmoothing(parseFloat(e.target.value))}
              className="smoothing-slider"
            />
          </label>
        </div>
        
        <div className="control-group">
          <label className="control-label">
            Horizontal Axis:
            <select
              value={xAxisType}
              onChange={(e) => setXAxisType(e.target.value as XAxisType)}
              className="axis-select"
            >
              <option value="step">Step</option>
              <option value="relative_time">Relative Time</option>
              <option value="wall_time">Wall Time</option>
            </select>
          </label>
        </div>
        
        <div className="control-group">
          <label className="control-label">
            Y Scale:
            <select
              value={yScaleType}
              onChange={(e) => setYScaleType(e.target.value as YScaleType)}
              className="axis-select"
            >
              <option value="linear">Linear</option>
              <option value="log">Logarithmic</option>
            </select>
          </label>
        </div>
        
        <div className="control-group">
          <label className="control-label checkbox-label">
            <input
              type="checkbox"
              checked={showOriginal}
              onChange={(e) => setShowOriginal(e.target.checked)}
            />
            Show Original Data
          </label>
        </div>
      </div>
      
      {/* Display each metric in its own collapsible chart */}
      <div className="charts-list">
        {tags.map((tag) => {
          const isCollapsed = collapsedTags.has(tag);
          const chartData = getChartDataForTag(tag);
          return (
            <div key={tag} className="collapsible-chart">
              <div 
                className="chart-title-bar" 
                onClick={() => toggleCollapse(tag)}
                style={{ borderLeftColor: CHART_COLOR }}
                role="button"
                aria-expanded={!isCollapsed}
                aria-controls={`chart-content-${tag.replace(/\//g, '-')}`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCollapse(tag);
                  }
                }}
              >
                <span className="collapse-icon" aria-hidden="true">{isCollapsed ? '▶' : '▼'}</span>
                <h3 className="chart-title" style={{ color: CHART_COLOR }}>
                  {tag}
                </h3>
                {!isCollapsed && (
                  <button
                    className="download-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportChartAsSVG(tag);
                    }}
                    title="Download as SVG (vector image for papers)"
                  >
                    📥 SVG
                  </button>
                )}
              </div>
              {!isCollapsed && (
                <div 
                  className="chart-content" 
                  id={`chart-content-${tag.replace(/\//g, '-')}`}
                  ref={(el) => {
                    if (el) {
                      chartRefs.current.set(tag, el);
                    } else {
                      chartRefs.current.delete(tag);
                    }
                  }}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey={getXDataKey()}
                        label={{ value: formatXAxisLabel(xAxisType), position: 'insideBottom', offset: -5 }}
                        tickFormatter={(value) => formatXAxisTick(value, xAxisType)}
                      />
                      <YAxis 
                        label={{ value: formatYAxisLabel(yScaleType), angle: -90, position: 'insideLeft' }}
                        tickFormatter={(value) => yScaleType === 'log' ? value.toFixed(2) : value.toLocaleString()}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          yScaleType === 'log' ? `10^${value.toFixed(3)} = ${(10 ** value).toFixed(4)}` : value.toFixed(4),
                          name
                        ]}
                        labelFormatter={(label) => formatXAxisTick(label as number, xAxisType)}
                      />
                      <Legend />
                      {showOriginal && smoothing > 0 && (
                        <Line 
                          type="monotone" 
                          dataKey="original"
                          stroke={ORIGINAL_COLOR}
                          name="Original"
                          dot={false}
                          strokeWidth={1}
                          strokeOpacity={0.5}
                          connectNulls
                        />
                      )}
                      <Line 
                        type="monotone" 
                        dataKey="smoothed"
                        stroke={SMOOTHED_COLOR}
                        name={smoothing > 0 ? "Smoothed" : "Value"}
                        dot={{ r: 2 }}
                        strokeWidth={2}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="chart-stats">
                    <span>Points: {chartData.length}</span>
                    {chartData.length > 0 && (
                      <>
                        <span>Min: {Math.min(...chartData.map(d => d.rawValue)).toFixed(4)}</span>
                        <span>Max: {Math.max(...chartData.map(d => d.rawValue)).toFixed(4)}</span>
                        <span>Last: {chartData[chartData.length - 1]?.rawValue.toFixed(4)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {tags.length === 0 && (
        <div className="no-selection">No scalar metrics available</div>
      )}
    </div>
  );
});

export default ScalarChart;
