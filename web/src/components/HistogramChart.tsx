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
  }, []);

  useEffect(() => {
    fetchHistograms();
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
