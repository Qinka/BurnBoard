import { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
  run: string;  // The run (subdirectory) this data belongs to
}

interface HistogramApiResponse {
  data: HistogramData[];
}

// Chart data for multi-run comparison
interface MultiRunHistogramChartData {
  name: string; // Statistic name: 'Min', 'Max', or 'Mean'
  [runName: string]: number | string | undefined;
}

interface HistogramChartProps {
  onRunsChange?: (runs: string[]) => void;
  visibleRuns?: Set<string>;
}

export interface HistogramChartHandle {
  refresh: () => void;
}

interface SingleHistogramChartData {
  name: string;
  value: number;
}

// Generate SVG content for histogram download
function generateHistogramSVG(
  chartData: SingleHistogramChartData[],
  tag: string,
  histogram: HistogramData,
  barColor: string
): string {
  const width = 600;
  const height = 450;
  const margin = { top: 60, right: 40, bottom: 80, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const barWidth = chartWidth / (chartData.length * 2);
  const barGap = barWidth / 2;

  // Get data ranges
  const yValues = chartData.map(d => d.value);
  const yMin = Math.min(0, ...yValues);
  const yMax = Math.max(...yValues);

  // Add some padding to y-axis
  const yRange = yMax - yMin;
  const yPadding = yRange * 0.1;
  const yAxisMin = yMin - yPadding;
  const yAxisMax = yMax + yPadding;

  // Scale functions
  const scaleY = (v: number) => margin.top + chartHeight - ((v - yAxisMin) / (yAxisMax - yAxisMin || 1)) * chartHeight;
  const zeroY = scaleY(0);

  // Generate tick values
  const generateTicks = (min: number, max: number, count: number = 5): number[] => {
    const step = (max - min) / (count - 1);
    return Array.from({ length: count }, (_, i) => min + i * step);
  };

  const yTicks = generateTicks(yAxisMin, yAxisMax, 6);

  // Format number for display
  const formatNumber = (n: number): string => {
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
    if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(2);
    return n.toFixed(2);
  };

  // Generate bars
  const bars = chartData.map((d, i) => {
    const x = margin.left + barGap + i * (barWidth + barGap * 2);
    const barHeight = Math.abs(scaleY(d.value) - zeroY);
    const y = d.value >= 0 ? scaleY(d.value) : zeroY;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${barColor}"/>`;
  });

  // Generate x-axis labels
  const xLabels = chartData.map((d, i) => {
    const x = margin.left + barGap + i * (barWidth + barGap * 2) + barWidth / 2;
    return `<text x="${x}" y="${height - margin.bottom + 25}" text-anchor="middle" class="tick-label">${d.name}</text>`;
  });

  const mean = histogram.num > 0 ? histogram.sum / histogram.num : 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { font: bold 18px sans-serif; }
    .subtitle { font: 12px sans-serif; fill: #666; }
    .axis-label { font: 14px sans-serif; }
    .tick-label { font: 11px sans-serif; }
    .info-text { font: 11px sans-serif; fill: #666; }
    .grid { stroke: #e0e0e0; stroke-width: 1; }
    .axis { stroke: #333; stroke-width: 1; }
  </style>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white"/>

  <!-- Title -->
  <text x="${width / 2}" y="25" text-anchor="middle" class="title">${tag}</text>
  <text x="${width / 2}" y="45" text-anchor="middle" class="subtitle">Step: ${histogram.step} | Count: ${histogram.num} | Sum: ${formatNumber(histogram.sum)}</text>

  <!-- Grid lines -->
  ${yTicks.map(tick => `<line x1="${margin.left}" y1="${scaleY(tick)}" x2="${width - margin.right}" y2="${scaleY(tick)}" class="grid"/>`).join('\n  ')}

  <!-- Axes -->
  <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" class="axis"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="axis"/>

  <!-- X-axis labels -->
  ${xLabels.join('\n  ')}
  <text x="${width / 2}" y="${height - 15}" text-anchor="middle" class="axis-label">Statistics</text>

  <!-- Y-axis ticks and labels -->
  ${yTicks.map(tick => `<text x="${margin.left - 10}" y="${scaleY(tick) + 4}" text-anchor="end" class="tick-label">${formatNumber(tick)}</text>`).join('\n  ')}
  <text x="20" y="${height / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, 20, ${height / 2})">Value</text>

  <!-- Bars -->
  ${bars.join('\n  ')}

  <!-- Info box -->
  <rect x="${width - margin.right - 140}" y="${margin.top}" width="130" height="60" fill="white" stroke="#ccc"/>
  <text x="${width - margin.right - 130}" y="${margin.top + 18}" class="info-text">Min: ${formatNumber(histogram.min)}</text>
  <text x="${width - margin.right - 130}" y="${margin.top + 34}" class="info-text">Max: ${formatNumber(histogram.max)}</text>
  <text x="${width - margin.right - 130}" y="${margin.top + 50}" class="info-text">Mean: ${formatNumber(mean)}</text>
</svg>`;
}

const HistogramChart = forwardRef<HistogramChartHandle, HistogramChartProps>(function HistogramChart({ onRunsChange, visibleRuns }, ref) {
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
      // Fetch with data sampling for performance (max 500 points per tag/run for histograms)
      const response = await fetch('/api/histograms?max_points=500');
      if (!response.ok) {
        throw new Error('Failed to fetch histograms');
      }
      const result: HistogramApiResponse = await response.json();

      // Update cache
      setDataCache({
        data: result.data,
        timestamp: Date.now(),
      });

      // Extract unique tags and sort alphabetically
      const uniqueTags = [...new Set(result.data.map(item => item.tag))].sort();
      setTags(uniqueTags);

      // Extract unique runs and sort alphabetically
      const uniqueRuns = [...new Set(result.data.map(item => item.run))].sort();
      setRuns(uniqueRuns);

      setData(result.data);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [dataCache]);

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

  // Get chart data for a specific tag with multiple runs
  const getChartDataForTag = (tag: string): { chartData: MultiRunHistogramChartData[], tagRuns: string[], histograms: Map<string, HistogramData> } => {
    const tagRuns = getRunsForTag(tag);
    const histograms = new Map<string, HistogramData>();

    // Get latest histogram for each run
    for (const run of tagRuns) {
      const latestHistogram = getLatestHistogramForTagAndRun(tag, run);
      if (latestHistogram) {
        histograms.set(run, latestHistogram);
      }
    }

    // Build chart data with values for each run
    const chartData: MultiRunHistogramChartData[] = [
      { name: 'Min' },
      { name: 'Max' },
      { name: 'Mean' },
    ];

    for (const run of tagRuns) {
      const histogram = histograms.get(run);
      if (histogram) {
        const mean = histogram.num > 0 ? histogram.sum / histogram.num : 0;
        chartData[0][run] = histogram.min;
        chartData[1][run] = histogram.max;
        chartData[2][run] = mean;
      }
    }

    return { chartData, tagRuns, histograms };
  };

  // Handle SVG download for histogram
  const handleDownloadSVG = (tag: string, run: string, histogram: HistogramData) => {
    const mean = histogram.num > 0 ? histogram.sum / histogram.num : 0;
    const chartData: SingleHistogramChartData[] = [
      { name: 'Min', value: histogram.min },
      { name: 'Max', value: histogram.max },
      { name: 'Mean', value: mean },
    ];
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
                    const { chartData, tagRuns, histograms } = getChartDataForTag(tag);
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
                            <ResizableChart
                              tag={tag}
                              defaultHeight={250}
                              minHeight={100}
                              maxHeight={600}
                            >
                              {(height) => (
                                <ResponsiveContainer width="100%" height={height}>
                                  <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    {tagRuns.length > 1 && <Legend />}
                                    {tagRuns.map((run) => (
                                      <Bar
                                        key={run}
                                        dataKey={run}
                                        fill={getRunColor(runs.indexOf(run))}
                                        name={run}
                                      />
                                    ))}
                                  </BarChart>
                                </ResponsiveContainer>
                              )}
                            </ResizableChart>
                            <div className="histogram-info-multi">
                              {tagRuns.map((run) => {
                                const histogram = histograms.get(run);
                                if (!histogram) return null;
                                return (
                                  <div key={run} className="histogram-run-info" style={{ borderLeftColor: getRunColor(runs.indexOf(run)) }}>
                                    <strong>{run}:</strong>
                                    <span>Count: {histogram.num}</span>
                                    <span>Sum: {histogram.sum.toFixed(2)}</span>
                                    <button
                                      type="button"
                                      className="download-btn"
                                      onClick={() => handleDownloadSVG(tag, run, histogram)}
                                      title="Download as SVG (vector image for papers)"
                                    >
                                      📥 SVG
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
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
