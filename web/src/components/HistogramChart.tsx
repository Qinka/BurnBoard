import { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import ResizableChart from './ResizableChart';
import { groupTagsByPrefix, getShortTagName } from '../utils/tagGrouping';
import { getRunColor } from '../utils/colors';

interface HistogramData {
  tag: string;
  step: number;
  min: number;
  max: number;
  sum: number;
  num: number;
  sum_squares: number;
  bucket_limit: number[];  // Upper bounds for each bucket
  bucket: number[];        // Count in each bucket
  run: string;  // The run (subdirectory) this data belongs to
}

interface HistogramApiResponse {
  data: HistogramData[];
}

// Chart data for histogram bucket distribution
interface BucketChartData {
  range: string;  // Bucket range label (e.g., "0.0 - 0.1")
  rangeStart: number;
  rangeEnd: number;
  count: number;
}

interface HistogramChartProps {
  onRunsChange?: (runs: string[]) => void;
  visibleRuns?: Set<string>;
  maxPoints?: number;
  onLatencyRecord?: (latency: number) => void;
}

export interface HistogramChartHandle {
  refresh: () => void;
}

// Format number for display
function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(2);
  return n.toFixed(2);
}

// Convert histogram to bucket chart data
function histogramToBucketData(histogram: HistogramData): BucketChartData[] {
  const data: BucketChartData[] = [];
  
  if (histogram.bucket_limit.length === 0 || histogram.bucket.length === 0) {
    return data;
  }
  
  let prevLimit = histogram.min;
  for (let i = 0; i < histogram.bucket_limit.length && i < histogram.bucket.length; i++) {
    const rangeEnd = histogram.bucket_limit[i];
    data.push({
      range: `${formatNumber(prevLimit)} - ${formatNumber(rangeEnd)}`,
      rangeStart: prevLimit,
      rangeEnd: rangeEnd,
      count: histogram.bucket[i],
    });
    prevLimit = rangeEnd;
  }
  
  return data;
}

// Generate SVG content for histogram download
function generateHistogramSVG(
  chartData: BucketChartData[],
  tag: string,
  histogram: HistogramData,
  barColor: string
): string {
  const width = 700;
  const height = 450;
  const margin = { top: 60, right: 40, bottom: 100, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  if (chartData.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle">No bucket data available</text>
</svg>`;
  }

  const barWidth = chartWidth / chartData.length;

  // Get data ranges
  const yValues = chartData.map(d => d.count);
  const yMax = Math.max(...yValues);

  // Scale functions
  const scaleY = (v: number) => margin.top + chartHeight - (v / (yMax || 1)) * chartHeight;

  // Generate tick values
  const generateTicks = (max: number, count: number = 5): number[] => {
    const step = max / (count - 1);
    return Array.from({ length: count }, (_, i) => i * step);
  };

  const yTicks = generateTicks(yMax, 6);

  // Generate bars
  const bars = chartData.map((d, i) => {
    const x = margin.left + i * barWidth;
    const barHeight = (d.count / (yMax || 1)) * chartHeight;
    const y = margin.top + chartHeight - barHeight;
    return `<rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" fill="${barColor}" opacity="0.8"/>`;
  });

  // Generate x-axis labels (show every Nth label to avoid overlap)
  const labelInterval = Math.max(1, Math.floor(chartData.length / 8));
  const xLabels = chartData.filter((_, i) => i % labelInterval === 0).map((d, i) => {
    const x = margin.left + (i * labelInterval) * barWidth + barWidth / 2;
    return `<text x="${x}" y="${height - margin.bottom + 20}" text-anchor="end" transform="rotate(-45, ${x}, ${height - margin.bottom + 20})" class="tick-label">${formatNumber(d.rangeStart)}</text>`;
  });

  const mean = histogram.num > 0 ? histogram.sum / histogram.num : 0;
  const std = histogram.num > 0 ? Math.sqrt(histogram.sum_squares / histogram.num - mean * mean) : 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { font: bold 18px sans-serif; }
    .subtitle { font: 12px sans-serif; fill: #666; }
    .axis-label { font: 14px sans-serif; }
    .tick-label { font: 10px sans-serif; }
    .info-text { font: 11px sans-serif; fill: #666; }
    .grid { stroke: #e0e0e0; stroke-width: 1; }
    .axis { stroke: #333; stroke-width: 1; }
  </style>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white"/>

  <!-- Title -->
  <text x="${width / 2}" y="25" text-anchor="middle" class="title">${tag}</text>
  <text x="${width / 2}" y="45" text-anchor="middle" class="subtitle">Step: ${histogram.step} | N: ${histogram.num} | Mean: ${formatNumber(mean)} | Std: ${formatNumber(std)}</text>

  <!-- Grid lines -->
  ${yTicks.map(tick => `<line x1="${margin.left}" y1="${scaleY(tick)}" x2="${width - margin.right}" y2="${scaleY(tick)}" class="grid"/>`).join('\n  ')}

  <!-- Axes -->
  <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" class="axis"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="axis"/>

  <!-- X-axis labels -->
  ${xLabels.join('\n  ')}
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" class="axis-label">Value</text>

  <!-- Y-axis ticks and labels -->
  ${yTicks.map(tick => `<text x="${margin.left - 10}" y="${scaleY(tick) + 4}" text-anchor="end" class="tick-label">${formatNumber(tick)}</text>`).join('\n  ')}
  <text x="20" y="${height / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, 20, ${height / 2})">Count</text>

  <!-- Bars -->
  ${bars.join('\n  ')}

  <!-- Info box -->
  <rect x="${width - margin.right - 120}" y="${margin.top}" width="110" height="70" fill="white" stroke="#ccc"/>
  <text x="${width - margin.right - 110}" y="${margin.top + 16}" class="info-text">Min: ${formatNumber(histogram.min)}</text>
  <text x="${width - margin.right - 110}" y="${margin.top + 32}" class="info-text">Max: ${formatNumber(histogram.max)}</text>
  <text x="${width - margin.right - 110}" y="${margin.top + 48}" class="info-text">Mean: ${formatNumber(mean)}</text>
  <text x="${width - margin.right - 110}" y="${margin.top + 64}" class="info-text">Std: ${formatNumber(std)}</text>
</svg>`;
}

const HistogramChart = forwardRef<HistogramChartHandle, HistogramChartProps>(function HistogramChart({ 
  onRunsChange, 
  visibleRuns,
  maxPoints = 100,
  onLatencyRecord 
}, ref) {
  const [data, setData] = useState<HistogramData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [runs, setRuns] = useState<string[]>([]);
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Group tags by "/" prefix
  const tagGroups = useMemo(() => groupTagsByPrefix(tags), [tags]);

  // Cache for data to avoid unnecessary refetches
  const [dataCache, setDataCache] = useState<{
    data: HistogramData[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 5000; // 5 seconds

  // Incremental update state
  const [lastMaxStep, setLastMaxStep] = useState<number>(-1);
  const [incrementalCounter, setIncrementalCounter] = useState<number>(0);
  const FULL_SYNC_INTERVAL = 10; // Do full sync every 10 incremental updates

  const fetchHistograms = useCallback(async (forceRefresh = false) => {
    // Check cache if not forcing refresh
    if (!forceRefresh && dataCache && (Date.now() - dataCache.timestamp) < CACHE_DURATION) {
      // Use cached data
      const uniqueTags = [...new Set(dataCache.data.map(item => item.tag))].sort();
      setTags(uniqueTags);

      const uniqueRuns = [...new Set(dataCache.data.map(item => item.run))].sort();
      setRuns(uniqueRuns);

      setData(dataCache.data);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      // Determine if this should be an incremental or full fetch
      const shouldFullSync = forceRefresh || incrementalCounter >= FULL_SYNC_INTERVAL || lastMaxStep === -1;
      
      const startTime = performance.now();
      let url = `/api/histograms?max_points=${maxPoints}`;
      
      // Add since_step for incremental updates
      if (!shouldFullSync && lastMaxStep > -1) {
        url += `&since_step=${lastMaxStep}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch histograms');
      }
      const result: HistogramApiResponse = await response.json();

      // Record latency for adaptive adjustment
      const endTime = performance.now();
      const latency = endTime - startTime;
      onLatencyRecord?.(latency);

      let combinedData: HistogramData[];
      
      if (shouldFullSync) {
        // Full sync - replace all data
        combinedData = result.data;
        setIncrementalCounter(0);
      } else {
        // Incremental update - merge new data with existing
        const existingData = dataCache?.data || [];
        
        // Create a map of existing data by unique key
        const existingMap = new Map<string, HistogramData>();
        for (const item of existingData) {
          const key = `${item.tag}|${item.run}|${item.step}`;
          existingMap.set(key, item);
        }
        
        // Add new data
        for (const item of result.data) {
          const key = `${item.tag}|${item.run}|${item.step}`;
          existingMap.set(key, item);
        }
        
        combinedData = Array.from(existingMap.values());
        setIncrementalCounter(prev => prev + 1);
      }

      // Update cache
      setDataCache({
        data: combinedData,
        timestamp: Date.now(),
      });

      // Track max step for next incremental update
      const maxStep = Math.max(...combinedData.map(d => d.step), -1);
      setLastMaxStep(maxStep);

      // Extract unique tags and sort alphabetically
      const uniqueTags = [...new Set(combinedData.map(item => item.tag))].sort();
      setTags(uniqueTags);

      // Extract unique runs and sort alphabetically
      const uniqueRuns = [...new Set(combinedData.map(item => item.run))].sort();
      setRuns(uniqueRuns);

      setData(combinedData);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [dataCache, incrementalCounter, lastMaxStep, maxPoints, onLatencyRecord]);

  useEffect(() => {
    fetchHistograms(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent when runs change
  useEffect(() => {
    if (onRunsChange) {
      onRunsChange(runs);
    }
  }, [runs, onRunsChange]);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: () => fetchHistograms(true)
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

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // Get all histograms for a specific tag and run, sorted by step
  const getHistogramsForTagAndRun = (tag: string, run: string): HistogramData[] => {
    return data
      .filter(item => item.tag === tag && item.run === run)
      .sort((a, b) => a.step - b.step);
  };

  // Get the latest histogram for a specific tag and run
  const getLatestHistogramForTagAndRun = (tag: string, run: string): HistogramData | null => {
    const tagRunData = data.filter(item => item.tag === tag && item.run === run);
    if (tagRunData.length === 0) return null;
    return tagRunData.reduce((max, item) =>
      item.step > max.step ? item : max
    );
  };

  // Get runs that have data for a specific tag (filtered by visibility)
  const getRunsForTag = (tag: string): string[] => {
    const tagData = data.filter(item => item.tag === tag);
    const allRuns = [...new Set(tagData.map(item => item.run))].sort();
    // Filter by visible runs if provided
    if (visibleRuns && visibleRuns.size > 0) {
      return allRuns.filter(run => visibleRuns.has(run));
    }
    return allRuns;
  };

  // Handle SVG download for histogram
  const handleDownloadSVG = (tag: string, run: string, histogram: HistogramData) => {
    const chartData = histogramToBucketData(histogram);
    const svgContent = generateHistogramSVG(
      chartData,
      tag,
      histogram,
      getRunColor(runs.indexOf(run))
    );

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
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
    <div className="chart-content-area">
      {/* Display histograms grouped by "/" prefix */}
      <div className="charts-list">
        {tagGroups.map((group) => {
          const isGroupCollapsed = collapsedGroups.has(group.name);
          const hasMultipleTags = group.tags.length > 1 || group.tags[0] !== group.name;

          return (
            <div key={group.name} className="metric-group">
              {hasMultipleTags && (
                <div
                  className="group-header"
                  onClick={() => toggleGroupCollapse(group.name)}
                  role="button"
                  aria-expanded={!isGroupCollapsed}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroupCollapse(group.name);
                    }
                  }}
                >
                  <span className="collapse-icon" aria-hidden="true">{isGroupCollapsed ? '▶' : '▼'}</span>
                  <h3 className="group-title">{group.name}</h3>
                  <span className="group-count">({group.tags.length})</span>
                </div>
              )}

              {!isGroupCollapsed && (
                <div className={hasMultipleTags ? "group-content" : ""}>
                  {group.tags.map((tag) => {
                    const isCollapsed = collapsedTags.has(tag);
                    const tagRuns = getRunsForTag(tag);
                    if (tagRuns.length === 0) return null;

                    const displayName = hasMultipleTags ? getShortTagName(tag, group.name) : tag;
                    const titleColor = tagRuns.length > 0
                      ? getRunColor(runs.indexOf(tagRuns[0]))
                      : getRunColor(0);

                    return (
                      <div key={tag} className="collapsible-chart">
                        <div
                          className="chart-title-bar"
                          onClick={() => toggleCollapse(tag)}
                          style={{ borderLeftColor: titleColor }}
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
                          <h3 className="chart-title">
                            {displayName}
                          </h3>
                        </div>
                        {!isCollapsed && (
                          <div className="chart-content" id={`histogram-content-${tag.replace(/\//g, '-')}`}>
                            {tagRuns.map((run) => {
                              const histograms = getHistogramsForTagAndRun(tag, run);
                              if (histograms.length === 0) return null;
                              
                              const latestHistogram = histograms[histograms.length - 1];
                              const bucketData = histogramToBucketData(latestHistogram);
                              const mean = latestHistogram.num > 0 ? latestHistogram.sum / latestHistogram.num : 0;
                              const std = latestHistogram.num > 0 
                                ? Math.sqrt(latestHistogram.sum_squares / latestHistogram.num - mean * mean) 
                                : 0;
                              const barColor = getRunColor(runs.indexOf(run));
                              
                              return (
                                <div key={run} className="histogram-run-section" style={{ borderLeftColor: barColor }}>
                                  <div className="histogram-run-header">
                                    <span className="histogram-run-name">{run}</span>
                                    <span className="histogram-step-info">Step: {latestHistogram.step}</span>
                                  </div>
                                  
                                  <ResizableChart
                                    tag={`${tag}-${run}`}
                                    defaultHeight={200}
                                    minHeight={100}
                                    maxHeight={400}
                                  >
                                    {(height) => (
                                      <ResponsiveContainer width="100%" height={height}>
                                        <BarChart data={bucketData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                          <CartesianGrid strokeDasharray="3 3" />
                                          <XAxis 
                                            dataKey="rangeStart" 
                                            tickFormatter={(value) => formatNumber(value)}
                                            label={{ value: 'Value', position: 'insideBottom', offset: -10 }}
                                            tick={{ fontSize: 11 }}
                                          />
                                          <YAxis 
                                            label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                                            tick={{ fontSize: 11 }}
                                          />
                                          <Tooltip 
                                            formatter={(value: number) => [value.toFixed(0), 'Count']}
                                            labelFormatter={(label: number) => `Value: ${formatNumber(label)}`}
                                          />
                                          <Bar
                                            dataKey="count"
                                            fill={barColor}
                                            opacity={0.8}
                                          />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    )}
                                  </ResizableChart>
                                  
                                  <div className="histogram-stats">
                                    <span>N: {latestHistogram.num.toFixed(0)}</span>
                                    <span>Min: {formatNumber(latestHistogram.min)}</span>
                                    <span>Max: {formatNumber(latestHistogram.max)}</span>
                                    <span>Mean: {formatNumber(mean)}</span>
                                    <span>Std: {formatNumber(std)}</span>
                                    <button
                                      type="button"
                                      className="download-btn"
                                      onClick={() => handleDownloadSVG(tag, run, latestHistogram)}
                                      title="Download as SVG"
                                    >
                                      📥 SVG
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
