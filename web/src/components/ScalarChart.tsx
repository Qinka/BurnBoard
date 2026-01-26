import { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ResizableChart from './ResizableChart';
import { groupTagsByPrefix, getShortTagName } from '../utils/tagGrouping';
import { getRunColor } from '../utils/colors';

interface ScalarData {
  tag: string;
  step: number;
  value: number;
  run: string;  // The run (subdirectory) this data belongs to
  wallTime?: number;  // Wall clock time in seconds
  relativeTime?: number;  // Relative time from first event
}

interface ScalarApiResponse {
  data: ScalarData[];
}

interface MultiRunChartData {
  x: number;
  [runName: string]: number | undefined;
}

interface ScalarChartProps {
  onRunsChange?: (runs: string[]) => void;
  visibleRuns?: Set<string>;
}

export interface ScalarChartHandle {
  refresh: () => void;
}

type XAxisType = 'step' | 'relative' | 'wall';
type YAxisTransform = 'original' | 'log' | 'exp';

interface RawPoint {
  x: number;
  value: number;
}

interface SingleRunPoint {
  x: number;
  value: number;
  smoothedValue: number;
}

const applySmoothing = (data: RawPoint[], weight: number): SingleRunPoint[] => {
  if (data.length === 0) return [];

  const result: SingleRunPoint[] = [];
  let smoothedValue = data[0].value;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (i === 0) {
      smoothedValue = item.value;
    } else {
      smoothedValue = weight * smoothedValue + (1 - weight) * item.value;
    }

    result.push({
      x: item.x,
      value: item.value,
      smoothedValue,
    });
  }

  return result;
};

const transformValue = (value: number, transform: YAxisTransform): number => {
  switch (transform) {
    case 'log':
      return value > 0 ? Math.log10(value) : NaN;
    case 'exp':
      return Math.exp(value);
    default:
      return value;
  }
};

const generateSVG = (
  allRunsData: Map<string, SingleRunPoint[]>,
  tag: string,
  xAxisType: XAxisType,
  yAxisTransform: YAxisTransform,
  smoothing: number,
  showSmoothed: boolean,
  runColors: Map<string, string>
): string => {
  const width = 800;
  const height = 500;
  const margin = { top: 60, right: 80, bottom: 80, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Collect all x and y values across all runs for proper scaling
  const allXValues: number[] = [];
  const allYValues: number[] = [];
  
  allRunsData.forEach((chartData) => {
    chartData.forEach(d => {
      allXValues.push(d.x);
      allYValues.push(transformValue(d.value, yAxisTransform));
      if (showSmoothed && smoothing > 0) {
        allYValues.push(transformValue(d.smoothedValue, yAxisTransform));
      }
    });
  });

  const validYValues = allYValues.filter(v => !isNaN(v) && isFinite(v));
  if (allXValues.length === 0 || validYValues.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="${width/2}" y="${height/2}" text-anchor="middle">No data available</text>
</svg>`;
  }

  const xMin = Math.min(...allXValues);
  const xMax = Math.max(...allXValues);
  const yMin = Math.min(...validYValues);
  const yMax = Math.max(...validYValues);

  const yRange = yMax - yMin;
  const yPadding = yRange * 0.1 || 0.1;
  const yAxisMin = yMin - yPadding;
  const yAxisMax = yMax + yPadding;

  const scaleX = (v: number) => margin.left + ((v - xMin) / (xMax - xMin || 1)) * chartWidth;
  const scaleY = (v: number) => margin.top + chartHeight - ((v - yAxisMin) / (yAxisMax - yAxisMin || 1)) * chartHeight;

  // Generate paths for each run
  const runPaths: string[] = [];
  const legendItems: string[] = [];
  let legendY = margin.top + 15;
  
  allRunsData.forEach((chartData, runName) => {
    const color = runColors.get(runName) || '#1f77b4';
    
    // Build original line path - track if previous point was valid for proper M/L commands
    const originalPathParts: string[] = [];
    let prevWasValid = false;
    
    for (let i = 0; i < chartData.length; i++) {
      const d = chartData[i];
      const x = scaleX(d.x);
      const yVal = transformValue(d.value, yAxisTransform);
      
      if (isNaN(yVal) || !isFinite(yVal)) {
        prevWasValid = false;
        continue;
      }
      
      const y = scaleY(yVal);
      // Use 'M' if this is the first valid point or if previous point was invalid
      const command = prevWasValid ? 'L' : 'M';
      originalPathParts.push(`${command} ${x} ${y}`);
      prevWasValid = true;
    }
    
    const originalPath = originalPathParts.join(' ');
    
    if (originalPath) {
      const opacity = smoothing > 0 && showSmoothed ? 0.4 : 1;
      runPaths.push(`<path d="${originalPath}" stroke="${color}" stroke-width="1.5" fill="none" opacity="${opacity}"/>`);
    }

    // Build smoothed line path
    if (showSmoothed && smoothing > 0) {
      const smoothedPathParts: string[] = [];
      prevWasValid = false;
      
      for (let i = 0; i < chartData.length; i++) {
        const d = chartData[i];
        const x = scaleX(d.x);
        const yVal = transformValue(d.smoothedValue, yAxisTransform);
        
        if (isNaN(yVal) || !isFinite(yVal)) {
          prevWasValid = false;
          continue;
        }
        
        const y = scaleY(yVal);
        const command = prevWasValid ? 'L' : 'M';
        smoothedPathParts.push(`${command} ${x} ${y}`);
        prevWasValid = true;
      }
      
      const smoothedPath = smoothedPathParts.join(' ');
      
      if (smoothedPath) {
        runPaths.push(`<path d="${smoothedPath}" stroke="${color}" stroke-width="2" fill="none"/>`);
      }
    }

    // Legend entry for this run
    legendItems.push(`
    <line x1="${width - margin.right - 110}" y1="${legendY}" x2="${width - margin.right - 80}" y2="${legendY}" stroke="${color}" stroke-width="2"/>
    <text x="${width - margin.right - 75}" y="${legendY + 4}" class="legend">${runName}</text>`);
    legendY += 20;
  });

  const xAxisLabel = xAxisType === 'step' ? 'Step' : xAxisType === 'relative' ? 'Relative Time (s)' : 'Wall Time (s)';

  let yAxisLabel = 'Value';
  if (yAxisTransform === 'log') yAxisLabel = 'Value (log₁₀)';
  if (yAxisTransform === 'exp') yAxisLabel = 'Value (exp)';

  const generateTicks = (min: number, max: number, count: number = 5): number[] => {
    const step = (max - min) / (count - 1);
    return Array.from({ length: count }, (_, i) => min + i * step);
  };

  const xTicks = generateTicks(xMin, xMax, 6);
  const yTicks = generateTicks(yAxisMin, yAxisMax, 6);

  const formatNumber = (n: number): string => {
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
    if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(2);
    return n.toFixed(2);
  };

  const legendHeight = allRunsData.size * 20 + 10;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { font: bold 18px sans-serif; }
    .subtitle { font: 12px sans-serif; fill: #666; }
    .axis-label { font: 14px sans-serif; }
    .tick-label { font: 11px sans-serif; }
    .legend { font: 12px sans-serif; }
    .grid { stroke: #e0e0e0; stroke-width: 1; }
    .axis { stroke: #333; stroke-width: 1; }
  </style>

  <rect width="${width}" height="${height}" fill="white"/>

  <text x="${width / 2}" y="25" text-anchor="middle" class="title">${tag}</text>
  <text x="${width / 2}" y="45" text-anchor="middle" class="subtitle">Smoothing: ${(smoothing * 100).toFixed(0)}% | X-Axis: ${xAxisLabel} | Y-Axis: ${yAxisLabel}</text>

  ${yTicks.map(tick => `<line x1="${margin.left}" y1="${scaleY(tick)}" x2="${width - margin.right}" y2="${scaleY(tick)}" class="grid"/>`).join('\n  ')}
  ${xTicks.map(tick => `<line x1="${scaleX(tick)}" y1="${margin.top}" x2="${scaleX(tick)}" y2="${height - margin.bottom}" class="grid"/>`).join('\n  ')}

  <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" class="axis"/>
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="axis"/>

  ${xTicks.map(tick => `<text x="${scaleX(tick)}" y="${height - margin.bottom + 20}" text-anchor="middle" class="tick-label">${formatNumber(tick)}</text>`).join('\n  ')}
  <text x="${width / 2}" y="${height - 20}" text-anchor="middle" class="axis-label">${xAxisLabel}</text>

  ${yTicks.map(tick => `<text x="${margin.left - 10}" y="${scaleY(tick) + 4}" text-anchor="end" class="tick-label">${formatNumber(tick)}</text>`).join('\n  ')}
  <text x="20" y="${height / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, 20, ${height / 2})">${yAxisLabel}</text>

  ${runPaths.join('\n  ')}

  <rect x="${width - margin.right - 120}" y="${margin.top}" width="110" height="${legendHeight}" fill="white" stroke="#ccc"/>
  ${legendItems.join('\n  ')}
</svg>`;
};

const ScalarChart = forwardRef<ScalarChartHandle, ScalarChartProps>(function ScalarChart({ onRunsChange, visibleRuns }, ref) {
  const [data, setData] = useState<ScalarData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [runs, setRuns] = useState<string[]>([]);
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New state for visualization controls
  const [smoothing, setSmoothing] = useState(0);  // 0-0.99
  const [xAxisType, setXAxisType] = useState<XAxisType>('step');
  const [yAxisTransform, setYAxisTransform] = useState<YAxisTransform>('original');
  const [showSmoothed, setShowSmoothed] = useState(true);

  const tagGroups = useMemo(() => groupTagsByPrefix(tags), [tags]);

  const fetchScalars = useCallback(async () => {
    try {
      const response = await fetch('/api/scalars');
      if (!response.ok) {
        throw new Error('Failed to fetch scalars');
      }
      const result: ScalarApiResponse = await response.json();

      const uniqueTags = [...new Set(result.data.map(item => item.tag))].sort();
      setTags(uniqueTags);

      const uniqueRuns = [...new Set(result.data.map(item => item.run))].sort();
      setRuns(uniqueRuns);

      const processedData: ScalarData[] = [];
      const tagFirstTime: Map<string, number> = new Map();
      // First pass: find first time for each tag (use wallTime if available, otherwise step)
      for (const item of result.data) {
        const itemTime = item.wallTime ?? item.step;
        const existing = tagFirstTime.get(item.tag);
        if (existing === undefined || itemTime < existing) {
          tagFirstTime.set(item.tag, itemTime);
        }
      }

      for (const item of result.data) {
        const firstTime = tagFirstTime.get(item.tag) ?? 0;
        const itemTime = item.wallTime ?? item.step;
        processedData.push({
          ...item,
          wallTime: itemTime,  // Use step as fallback for wall time
          relativeTime: itemTime - firstTime,
        });
      }

      setData(processedData);
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

  // Notify parent when runs change
  useEffect(() => {
    if (onRunsChange) {
      onRunsChange(runs);
    }
  }, [runs, onRunsChange]);

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

  const getRunsForTag = (tag: string): string[] => {
    const tagData = data.filter(item => item.tag === tag);
    const allRuns = [...new Set(tagData.map(item => item.run))].sort();
    if (visibleRuns && visibleRuns.size > 0) {
      return allRuns.filter(run => visibleRuns.has(run));
    }
    return allRuns;
  };

  const getXValue = (item: ScalarData): number => {
    switch (xAxisType) {
      case 'relative':
        return item.relativeTime ?? item.step;
      case 'wall':
        return item.wallTime ?? item.step;
      default:
        return item.step;
    }
  };

  const getChartDataForTag = (tag: string): { chartData: MultiRunChartData[]; tagRuns: string[] } => {
    const tagRuns = getRunsForTag(tag);
    const byX = new Map<number, MultiRunChartData>();

    for (const run of tagRuns) {
      const runPoints: RawPoint[] = data
        .filter(item => item.tag === tag && item.run === run)
        .map(item => ({ x: getXValue(item), value: item.value }))
        .sort((a, b) => a.x - b.x);

      const smoothed = applySmoothing(runPoints, smoothing);

      for (const point of smoothed) {
        const entry = byX.get(point.x) ?? { x: point.x };
        entry[run] = transformValue(point.value, yAxisTransform);
        entry[`${run}__smoothed`] = transformValue(point.smoothedValue, yAxisTransform);
        byX.set(point.x, entry);
      }
    }

    const chartData = Array.from(byX.values()).sort((a, b) => a.x - b.x);
    return { chartData, tagRuns };
  };

  const getSeriesForRun = (tag: string, run: string): SingleRunPoint[] => {
    const runPoints: RawPoint[] = data
      .filter(item => item.tag === tag && item.run === run)
      .map(item => ({ x: getXValue(item), value: item.value }))
      .sort((a, b) => a.x - b.x);
    return applySmoothing(runPoints, smoothing);
  };

  const getXAxisLabel = (): string => {
    switch (xAxisType) {
      case 'relative':
        return 'Relative Time (s)';
      case 'wall':
        return 'Wall Time (s)';
      default:
        return 'Step';
    }
  };

  const getYAxisLabel = (): string => {
    switch (yAxisTransform) {
      case 'log':
        return 'Value (log₁₀)';
      case 'exp':
        return 'Value (exp)';
      default:
        return 'Value';
    }
  };

  const handleDownloadSVG = (tag: string, tagRuns: string[]) => {
    // Collect data for all runs
    const allRunsData = new Map<string, SingleRunPoint[]>();
    const runColors = new Map<string, string>();
    
    for (const run of tagRuns) {
      const series = getSeriesForRun(tag, run);
      if (series.length > 0) {
        allRunsData.set(run, series);
        runColors.set(run, getRunColor(runs.indexOf(run)));
      }
    }
    
    const svgContent = generateSVG(allRunsData, tag, xAxisType, yAxisTransform, smoothing, showSmoothed, runColors);

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tag.replace(/\//g, '_')}_chart.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Custom tooltip formatter - data is already transformed, just format it
  const formatTooltipValue = (value: number): string => {
    if (isNaN(value) || !isFinite(value)) return 'N/A';
    return value.toFixed(6);
  };

  if (loading) {
    return <div className="loading">Loading scalar data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="chart-content-area">
      <div className="chart-header">
        <h2>Scalar Values</h2>
        {runs.length > 1 && (
          <div className="runs-legend">
            <span className="runs-label">Runs: </span>
            {runs.map((run, index) => (
              <span
                key={run}
                className="run-badge"
                style={{ backgroundColor: getRunColor(index) }}
              >
                {run}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="visualization-controls">
        <div className="control-group">
          <label className="control-label">
            Smoothing: {(smoothing * 100).toFixed(0)}%
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
          {smoothing > 0 && (
            <label className="show-smoothed-toggle">
              <input
                type="checkbox"
                checked={showSmoothed}
                onChange={(e) => setShowSmoothed(e.target.checked)}
              />
              Show Smoothed
            </label>
          )}
        </div>

        <div className="control-group">
          <label className="control-label">
            X-Axis:
            <select
              value={xAxisType}
              onChange={(e) => setXAxisType(e.target.value as XAxisType)}
              className="axis-selector"
            >
              <option value="step">Step</option>
              <option value="relative">Relative Time</option>
              <option value="wall">Wall Time</option>
            </select>
          </label>
        </div>

        <div className="control-group">
          <label className="control-label">
            Y-Axis:
            <select
              value={yAxisTransform}
              onChange={(e) => setYAxisTransform(e.target.value as YAxisTransform)}
              className="axis-selector"
            >
              <option value="original">Original</option>
              <option value="log">Log₁₀</option>
              <option value="exp">Exponential</option>
            </select>
          </label>
        </div>
      </div>

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
                    const { chartData, tagRuns } = getChartDataForTag(tag);
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
                          <h3 className="chart-title">
                            {displayName}
                          </h3>
                          {!isCollapsed && tagRuns.length > 0 && (
                            <button
                              type="button"
                              className="download-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSVG(tag, tagRuns);
                              }}
                              title="Download as SVG (vector image for papers)"
                            >
                              📥 SVG
                            </button>
                          )}
                        </div>
                        {!isCollapsed && (
                          <div className="chart-content" id={`chart-content-${tag.replace(/\//g, '-')}`}>
                            <ResizableChart
                              tag={tag}
                              defaultHeight={250}
                              minHeight={100}
                              maxHeight={600}
                            >
                              {(height) => (
                                <ResponsiveContainer width="100%" height={height}>
                                  <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                      dataKey="x"
                                      label={{ value: getXAxisLabel(), position: 'insideBottom', offset: -5 }}
                                    />
                                    <YAxis
                                      label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft' }}
                                      domain={['auto', 'auto']}
                                      allowDataOverflow
                                    />
                                    <Tooltip
                                      formatter={(value, name) => {
                                        const numericValue = typeof value === 'number' ? value : Number(value);
                                        return [formatTooltipValue(numericValue), String(name ?? '')];
                                      }}
                                    />
                                    <Legend />
                                    {tagRuns.map((run) => (
                                      <Line
                                        key={run}
                                        type="monotone"
                                        dataKey={run}
                                        stroke={getRunColor(runs.indexOf(run))}
                                        name={run}
                                        dot={{ r: 2 }}
                                        connectNulls
                                        strokeWidth={1}
                                        opacity={smoothing > 0 && showSmoothed ? 0.4 : 1}
                                      />
                                    ))}
                                    {smoothing > 0 && showSmoothed && tagRuns.map((run) => (
                                      <Line
                                        key={`${run}-smoothed`}
                                        type="monotone"
                                        dataKey={`${run}__smoothed`}
                                        stroke={getRunColor(runs.indexOf(run))}
                                        name={`${run} (smoothed)`}
                                        dot={false}
                                        connectNulls
                                        strokeWidth={2}
                                      />
                                    ))}
                                  </LineChart>
                                </ResponsiveContainer>
                              )}
                            </ResizableChart>
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
        <div className="no-selection">No scalar metrics available</div>
      )}
    </div>
  );
});

export default ScalarChart;
