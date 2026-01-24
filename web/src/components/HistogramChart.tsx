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
  name: string;
  value: number;
}

export interface HistogramChartHandle {
  refresh: () => void;
}

const HistogramChart = forwardRef<HistogramChartHandle>(function HistogramChart(_props, ref) {
  const [data, setData] = useState<HistogramData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
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
      
      // Set default tag only if none selected
      setSelectedTag(prev => {
        if (uniqueTags.length > 0 && !prev) {
          return uniqueTags[0];
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

  const getChartData = (): ChartData[] => {
    if (!selectedTag) return [];
    
    // Get the latest histogram for the selected tag
    const histograms = data.filter(item => item.tag === selectedTag);
    if (histograms.length === 0) return [];
    
    const latest = histograms.reduce((max, item) => 
      item.step > max.step ? item : max
    );
    
    return [
      { name: 'Min', value: latest.min },
      { name: 'Max', value: latest.max },
      { name: 'Mean', value: latest.sum / latest.num },
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
        <select 
          value={selectedTag} 
          onChange={(e) => setSelectedTag(e.target.value)}
          className="tag-selector"
        >
          {tags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={getChartData()}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
      {selectedTag && (() => {
        const tagData = data.filter(item => item.tag === selectedTag);
        if (tagData.length > 0) {
          const latest = tagData[0];
          return (
            <div className="histogram-info">
              <p>Count: {latest.num}</p>
              <p>Sum: {latest.sum.toFixed(2)}</p>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
});

export default HistogramChart;
