import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface HistogramData {
  tag: string;
  step: number;
  min: number;
  max: number;
  sum: number;
  num: number;
}

interface HistogramApiResponse {
  data: HistogramData[];
}

interface ChartData {
  name: string; // Statistic name: 'Min', 'Max', or 'Mean'
  [key: string]: number | string; // Dynamic keys: tag names map to their statistic values
}

export interface HistogramChartHandle {
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

const HistogramChart = forwardRef<HistogramChartHandle>(function HistogramChart(_props, ref) {
  const [data, setData] = useState<HistogramData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistograms = useCallback(async () => {
    try {
      const response = await fetch('/api/histograms');
      if (!response.ok) {
        throw new Error('Failed to fetch histograms');
      }
      const result: HistogramApiResponse = await response.json();
      
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
    fetchHistograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchHistograms
  }), [fetchHistograms]);

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

  // Compute latest histograms for each selected tag (used by both chart and info display)
  const getLatestHistograms = (): Map<string, HistogramData> => {
    const latestHistograms = new Map<string, HistogramData>();
    
    data
      .filter(item => selectedTags.has(item.tag))
      .forEach(item => {
        const existing = latestHistograms.get(item.tag);
        if (!existing || item.step > existing.step) {
          latestHistograms.set(item.tag, item);
        }
      });
    
    return latestHistograms;
  };

  const getChartData = (latestHistograms: Map<string, HistogramData>): ChartData[] => {
    if (selectedTags.size === 0) return [];
    
    // Create chart data with Min, Max, Mean for each selected tag
    const chartData: ChartData[] = [
      { name: 'Min' },
      { name: 'Max' },
      { name: 'Mean' },
    ];
    
    latestHistograms.forEach((histogram, tag) => {
      chartData[0][tag] = histogram.min;
      chartData[1][tag] = histogram.max;
      chartData[2][tag] = histogram.sum / histogram.num;
    });
    
    return chartData;
  };

  if (loading) {
    return <div className="loading">Loading histogram data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const latestHistograms = getLatestHistograms();
  const chartData = getChartData(latestHistograms);
  const selectedTagsArray = Array.from(selectedTags);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2>Histogram Statistics</h2>
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
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {selectedTagsArray.map((tag) => {
            const colorIndex = tags.indexOf(tag);
            return (
              <Bar 
                key={tag}
                dataKey={tag} 
                fill={COLORS[colorIndex % COLORS.length]} 
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
      {selectedTagsArray.length > 0 && (
        <div className="histogram-info-multi">
          {selectedTagsArray.map((tag) => {
            const latest = latestHistograms.get(tag);
            if (latest) {
              const colorIndex = tags.indexOf(tag);
              return (
                <div 
                  key={tag} 
                  className="histogram-info-item"
                  style={{ borderLeftColor: COLORS[colorIndex % COLORS.length] }}
                >
                  <strong>{tag}</strong>
                  <span>Count: {latest.num}</span>
                  <span>Sum: {latest.sum.toFixed(2)}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
});

export default HistogramChart;
