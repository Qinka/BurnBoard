import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

interface SingleHistogramChartData {
  name: string; // Statistic name: 'Min', 'Max', or 'Mean'
  value: number;
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

  // Get the latest histogram for a specific tag
  const getLatestHistogramForTag = (tag: string): HistogramData | null => {
    const tagData = data.filter(item => item.tag === tag);
    if (tagData.length === 0) return null;
    return tagData.reduce((max, item) => 
      item.step > max.step ? item : max
    );
  };

  // Get chart data for a specific tag
  const getChartDataForTag = (histogram: HistogramData): SingleHistogramChartData[] => {
    return [
      { name: 'Min', value: histogram.min },
      { name: 'Max', value: histogram.max },
      { name: 'Mean', value: histogram.sum / histogram.num },
    ];
  };

  if (loading) {
    return <div className="loading">Loading histogram data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

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
      {/* Display each selected histogram in its own chart */}
      <div className="charts-grid">
        {selectedTagsArray.map((tag) => {
          const colorIndex = tags.indexOf(tag);
          const latestHistogram = getLatestHistogramForTag(tag);
          if (!latestHistogram) return null;
          
          const chartData = getChartDataForTag(latestHistogram);
          return (
            <div key={tag} className="individual-chart">
              <h3 className="chart-title" style={{ color: COLORS[colorIndex % COLORS.length] }}>
                {tag}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar 
                    dataKey="value" 
                    fill={COLORS[colorIndex % COLORS.length]} 
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="histogram-info-single">
                <span>Count: {latestHistogram.num}</span>
                <span>Sum: {latestHistogram.sum.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {selectedTagsArray.length === 0 && (
        <div className="no-selection">Select metrics to display charts</div>
      )}
    </div>
  );
});

export default HistogramChart;
