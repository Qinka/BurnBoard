import { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface HistogramData {
  tag: string;
  step: number;
  wall_time: number;
  min: number;
  max: number;
  sum: number;
  num: number;
}

interface HistogramApiResponse {
  data: HistogramData[];
}

interface SingleHistogramChartData {
  name: string; // Statistic name: 'Min', 'Max', or 'Mean'
  value: number;
}

interface HistogramTimeSeriesData {
  step: number;
  wall_time: number;
  relative_time: number;
  min: number;
  max: number;
  mean: number;
}

export interface HistogramChartHandle {
  refresh: () => void;
}

// Horizontal axis types
type XAxisType = 'step' | 'relative_time' | 'wall_time';

// Display mode types
type DisplayMode = 'latest' | 'timeseries';

// Unified color for all metrics
const CHART_COLOR = '#1f77b4'; // blue

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

const HistogramChart = forwardRef<HistogramChartHandle>(function HistogramChart(_props, ref) {
  const [data, setData] = useState<HistogramData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Visualization settings
  const [xAxisType, setXAxisType] = useState<XAxisType>('step');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('latest');
  
  // Refs for SVG export
  const chartRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const fetchHistograms = useCallback(async () => {
    try {
      const response = await fetch('/api/histograms');
      if (!response.ok) {
        throw new Error('Failed to fetch histograms');
      }
      const result: HistogramApiResponse = await response.json();
      
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
    fetchHistograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchHistograms
  }), [fetchHistograms]);

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

  // Get the latest histogram for a specific tag
  const getLatestHistogramForTag = (tag: string): HistogramData | null => {
    const tagData = data.filter(item => item.tag === tag);
    if (tagData.length === 0) return null;
    return tagData.reduce((max, item) => 
      item.step > max.step ? item : max
    );
  };

  // Get chart data for a specific tag (latest mode)
  const getChartDataForTag = (histogram: HistogramData): SingleHistogramChartData[] => {
    const mean = histogram.num > 0 ? histogram.sum / histogram.num : 0;
    return [
      { name: 'Min', value: histogram.min },
      { name: 'Max', value: histogram.max },
      { name: 'Mean', value: mean },
    ];
  };

  // Get time series data for a specific tag
  const getTimeSeriesDataForTag = (tag: string): HistogramTimeSeriesData[] => {
    const tagData = data
      .filter(item => item.tag === tag)
      .sort((a, b) => a.step - b.step);
    
    if (tagData.length === 0) return [];
    
    const firstWallTime = tagData[0].wall_time;
    
    return tagData.map(item => ({
      step: item.step,
      wall_time: item.wall_time,
      relative_time: item.wall_time - firstWallTime,
      min: item.min,
      max: item.max,
      mean: item.num > 0 ? item.sum / item.num : 0,
    }));
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
      type: 'histogram',
      displayMode: displayMode,
      xAxis: displayMode === 'timeseries' ? formatXAxisLabel(xAxisType) : 'Statistics',
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
    link.download = `${tag.replace(/\//g, '_')}_histogram.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="loading">Loading histogram data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2>Histogram Statistics</h2>
      </div>
      
      {/* Global visualization controls */}
      <div className="visualization-controls">
        <div className="control-group">
          <label className="control-label">
            Display Mode:
            <select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
              className="axis-select"
            >
              <option value="latest">Latest Values</option>
              <option value="timeseries">Time Series</option>
            </select>
          </label>
        </div>
        
        {displayMode === 'timeseries' && (
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
        )}
      </div>
      
      {/* Display each histogram in its own collapsible chart */}
      <div className="charts-list">
        {tags.map((tag) => {
          const isCollapsed = collapsedTags.has(tag);
          const latestHistogram = getLatestHistogramForTag(tag);
          if (!latestHistogram) return null;
          
          const chartData = displayMode === 'latest' 
            ? getChartDataForTag(latestHistogram)
            : [];
          const timeSeriesData = displayMode === 'timeseries'
            ? getTimeSeriesDataForTag(tag)
            : [];
          
          return (
            <div key={tag} className="collapsible-chart">
              <div 
                className="chart-title-bar" 
                onClick={() => toggleCollapse(tag)}
                style={{ borderLeftColor: CHART_COLOR }}
                role="button"
                aria-expanded={!isCollapsed}
                aria-controls={`histogram-content-${tag.replace(/\//g, '-')}`}
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
                  id={`histogram-content-${tag.replace(/\//g, '-')}`}
                  ref={(el) => {
                    if (el) {
                      chartRefs.current.set(tag, el);
                    } else {
                      chartRefs.current.delete(tag);
                    }
                  }}
                >
                  {displayMode === 'latest' ? (
                    <>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar 
                            dataKey="value" 
                            fill={CHART_COLOR} 
                          />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="histogram-info-single">
                        <span>Step: {latestHistogram.step}</span>
                        <span>Count: {latestHistogram.num}</span>
                        <span>Sum: {latestHistogram.sum.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={timeSeriesData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey={getXDataKey()}
                            label={{ value: formatXAxisLabel(xAxisType), position: 'insideBottom', offset: -5 }}
                            tickFormatter={(value) => formatXAxisTick(value, xAxisType)}
                          />
                          <YAxis 
                            label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => [value.toFixed(4), name]}
                            labelFormatter={(label) => formatXAxisTick(label as number, xAxisType)}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="min"
                            stroke="#82ca9d"
                            name="Min"
                            dot={{ r: 2 }}
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="mean"
                            stroke={CHART_COLOR}
                            name="Mean"
                            dot={{ r: 2 }}
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="max"
                            stroke="#ff7300"
                            name="Max"
                            dot={{ r: 2 }}
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="chart-stats">
                        <span>Points: {timeSeriesData.length}</span>
                        <span>Latest Count: {latestHistogram.num}</span>
                        <span>Latest Sum: {latestHistogram.sum.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {tags.length === 0 && (
        <div className="no-selection">No histogram metrics available</div>
      )}
    </div>
  );
});

export default HistogramChart;
