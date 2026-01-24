import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ScalarData {
  tag: string;
  step: number;
  value: number;
}

interface ScalarApiResponse {
  data: ScalarData[];
}

interface SingleTagChartData {
  step: number;
  value: number;
}

export interface ScalarChartHandle {
  refresh: () => void;
}

// Color palette for multiple metrics (TensorBoard-like colors)
const COLORS = [
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

const ScalarChart = forwardRef<ScalarChartHandle>(function ScalarChart(_props, ref) {
  const [data, setData] = useState<ScalarData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
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
    return data
      .filter(item => item.tag === tag)
      .sort((a, b) => a.step - b.step)
      .map(item => ({
        step: item.step,
        value: item.value,
      }));
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
      {/* Display each metric in its own collapsible chart */}
      <div className="charts-list">
        {tags.map((tag, index) => {
          const isCollapsed = collapsedTags.has(tag);
          const chartData = getChartDataForTag(tag);
          return (
            <div key={tag} className="collapsible-chart">
              <div 
                className="chart-title-bar" 
                onClick={() => toggleCollapse(tag)}
                style={{ borderLeftColor: COLORS[index % COLORS.length] }}
              >
                <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                <h3 className="chart-title" style={{ color: COLORS[index % COLORS.length] }}>
                  {tag}
                </h3>
              </div>
              {!isCollapsed && (
                <div className="chart-content">
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
                      <Line 
                        type="monotone" 
                        dataKey="value"
                        stroke={COLORS[index % COLORS.length]}
                        name={tag}
                        dot={{ r: 2 }}
                        connectNulls
                      />
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
