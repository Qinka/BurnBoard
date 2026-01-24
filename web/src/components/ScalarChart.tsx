import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
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

interface ScalarData {
  tag: string;
  step: number;
  value: number;
}

interface ScalarApiResponse {
  data: ScalarData[];
}

interface ChartDataPoint {
  step: number;
  [key: string]: number; // Dynamic keys: tag names map to their scalar values at this step
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
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScalars = useCallback(async () => {
    try {
      const response = await fetch('/api/scalars');
      if (!response.ok) {
        throw new Error('Failed to fetch scalars');
      }
      const result: ScalarApiResponse = await response.json();
      
      // Extract unique tags
      const uniqueTags = [...new Set(result.data.map(item => item.tag))];
      setTags(uniqueTags);
      
      // Select all tags by default on first load
      setSelectedTags(prev => {
        if (prev.size === 0 && uniqueTags.length > 0) {
          return new Set(uniqueTags);
        }
        return prev;
      });
      
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

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedTags(new Set(tags));
  };

  const selectNone = () => {
    setSelectedTags(new Set());
  };

  const getChartData = (): ChartDataPoint[] => {
    if (selectedTags.size === 0) return [];
    
    // Group data by step for all selected tags
    const stepMap = new Map<number, ChartDataPoint>();
    
    data
      .filter(item => selectedTags.has(item.tag))
      .forEach(item => {
        if (!stepMap.has(item.step)) {
          stepMap.set(item.step, { step: item.step });
        }
        const point = stepMap.get(item.step)!;
        point[item.tag] = item.value;
      });
    
    return Array.from(stepMap.values()).sort((a, b) => a.step - b.step);
  };

  if (loading) {
    return <div className="loading">Loading scalar data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const chartData = getChartData();
  const selectedTagsArray = Array.from(selectedTags);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2>Scalar Values</h2>
        <div className="tag-controls">
          <button className="tag-control-btn" onClick={selectAll}>Select All</button>
          <button className="tag-control-btn" onClick={selectNone}>Clear</button>
        </div>
      </div>
      <div className="tag-selector-multi">
        {tags.map((tag, index) => {
          const isChecked = selectedTags.has(tag);
          return (
            <label 
              key={tag} 
              className={`tag-checkbox ${isChecked ? 'tag-checked' : 'tag-unchecked'}`}
              style={{ borderColor: COLORS[index % COLORS.length] }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleTag(tag)}
              />
              <span 
                className="tag-color-indicator" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="tag-label">{tag}</span>
            </label>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={400}>
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
          <Legend />
          {selectedTagsArray.map((tag) => {
            const colorIndex = tags.indexOf(tag);
            return (
              <Line 
                key={tag}
                type="monotone" 
                dataKey={tag}
                stroke={COLORS[colorIndex % COLORS.length]}
                name={tag}
                dot={{ r: 2 }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default ScalarChart;
