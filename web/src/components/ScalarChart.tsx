import { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
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
import ResizableChart from './ResizableChart';

interface ScalarData {
  tag: string;
  step: number;
  value: number;
  run: string;  // The run (subdirectory) this data belongs to
}

interface ScalarApiResponse {
  data: ScalarData[];
}

// Chart data with step and values for each run
interface MultiRunChartData {
  step: number;
  [runName: string]: number | undefined;
}

interface TagGroup {
  name: string;
  tags: string[];
}

export interface ScalarChartHandle {
  refresh: () => void;
}

// Color palette for different runs
const RUN_COLORS = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
];

const getRunColor = (index: number): string => {
  return RUN_COLORS[index % RUN_COLORS.length];
};

// Helper function to group tags by "/" prefix
const groupTagsByPrefix = (tags: string[]): TagGroup[] => {
  const groupMap = new Map<string, string[]>();

  tags.forEach(tag => {
    const slashIndex = tag.indexOf('/');
    if (slashIndex > 0) {
      const prefix = tag.substring(0, slashIndex);
      const existing = groupMap.get(prefix) || [];
      existing.push(tag);
      groupMap.set(prefix, existing);
    } else {
      const existing = groupMap.get(tag) || [];
      existing.push(tag);
      groupMap.set(tag, existing);
    }
  });

  return Array.from(groupMap.entries())
    .map(([name, tags]) => ({ name, tags: tags.sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const ScalarChart = forwardRef<ScalarChartHandle>(function ScalarChart(_props, ref) {
  const [data, setData] = useState<ScalarData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [runs, setRuns] = useState<string[]>([]);
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Group tags by "/" prefix
  const tagGroups = useMemo(() => groupTagsByPrefix(tags), [tags]);

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

  // Get the short name for a tag (part after the group prefix)
  const getShortTagName = (tag: string, groupName: string): string => {
    if (tag.startsWith(groupName + '/')) {
      return tag.substring(groupName.length + 1);
    }
    return tag;
  };

  // Get chart data for a specific tag, with all runs combined by step
  const getChartDataForTag = (tag: string): MultiRunChartData[] => {
    const tagData = data.filter(item => item.tag === tag);

    // Group data by step, with values for each run
    const stepMap = new Map<number, MultiRunChartData>();

    for (const item of tagData) {
      if (!stepMap.has(item.step)) {
        stepMap.set(item.step, { step: item.step });
      }
      const entry = stepMap.get(item.step)!;
      entry[item.run] = item.value;
    }

    // Convert to array and sort by step
    return Array.from(stepMap.values()).sort((a, b) => a.step - b.step);
  };

  // Get runs that have data for a specific tag
  const getRunsForTag = (tag: string): string[] => {
    const tagData = data.filter(item => item.tag === tag);
    return [...new Set(tagData.map(item => item.run))].sort();
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
      {/* Display metrics grouped by "/" prefix */}
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
                    const chartData = getChartDataForTag(tag);
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
                                      dataKey="step"
                                      label={{ value: 'Step', position: 'insideBottom', offset: -5 }}
                                    />
                                    <YAxis
                                      label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                                    />
                                    <Tooltip />
                                    {tagRuns.length > 1 && <Legend />}
                                    {tagRuns.map((run) => (
                                      <Line
                                        key={run}
                                        type="monotone"
                                        dataKey={run}
                                        stroke={getRunColor(runs.indexOf(run))}
                                        name={run}
                                        dot={{ r: 2 }}
                                        connectNulls
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
