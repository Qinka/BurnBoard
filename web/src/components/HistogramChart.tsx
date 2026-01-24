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
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const mean = histogram.num > 0 ? histogram.sum / histogram.num : 0;
    return [
      { name: 'Min', value: histogram.min },
      { name: 'Max', value: histogram.max },
      { name: 'Mean', value: mean },
    ];
  };

  if (loading) {
    return <div className="loading">Loading histogram data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2>Histogram Statistics</h2>
      </div>
      {/* Display each histogram in its own collapsible chart */}
      <div className="charts-list">
        {tags.map((tag, index) => {
          const isCollapsed = collapsedTags.has(tag);
          const latestHistogram = getLatestHistogramForTag(tag);
          if (!latestHistogram) return null;
          
          const chartData = getChartDataForTag(latestHistogram);
          return (
            <div key={tag} className="collapsible-chart">
              <div 
                className="chart-title-bar" 
                onClick={() => toggleCollapse(tag)}
                style={{ borderLeftColor: COLORS[index % COLORS.length] }}
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
                <h3 className="chart-title" style={{ color: COLORS[index % COLORS.length] }}>
                  {tag}
                </h3>
              </div>
              {!isCollapsed && (
                <div className="chart-content" id={`histogram-content-${tag.replace(/\//g, '-')}`}>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar 
                        dataKey="value" 
                        fill={COLORS[index % COLORS.length]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="histogram-info-single">
                    <span>Count: {latestHistogram.num}</span>
                    <span>Sum: {latestHistogram.sum.toFixed(2)}</span>
                  </div>
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
