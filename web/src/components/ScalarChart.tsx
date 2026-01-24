import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
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
// TensorBoard-style orange color for all metrics
const CHART_COLOR = '#FF6F00'; // Primary orange

const ScalarChart = forwardRef<ScalarChartHandle>(function ScalarChart(_props, ref) {
  const [data, setData] = useState<ScalarData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [runs, setRuns] = useState<string[]>([]);
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      {/* Display each metric in its own collapsible chart */}
      <div className="charts-list">
        {tags.map((tag) => {
          const isCollapsed = collapsedTags.has(tag);
          const chartData = getChartDataForTag(tag);
          const tagRuns = getRunsForTag(tag);
          return (
            <div key={tag} className="collapsible-chart">
              <div
                className="chart-title-bar"
                onClick={() => toggleCollapse(tag)}
                style={{ borderLeftColor: getRunColor(0) }}
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
                  {tag}
                </h3>
              </div>
              {!isCollapsed && (
                <div className="chart-content" id={`chart-content-${tag.replace(/\//g, '-')}`}>
                  <ResponsiveContainer width="100%" height={250}>
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
                      {tagRuns.map((run, index) => (
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
