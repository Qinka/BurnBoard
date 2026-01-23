import { useEffect, useState } from 'react';
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

export default function HistogramChart() {
  const [data, setData] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistograms();
  }, []);

  const fetchHistograms = async () => {
    try {
      const response = await fetch('/api/histograms');
      if (!response.ok) {
        throw new Error('Failed to fetch histograms');
      }
      const result = await response.json();
      
      // Extract unique tags
      const uniqueTags = [...new Set(result.data.map(item => item.tag))];
      setTags(uniqueTags);
      
      // Set default tag
      if (uniqueTags.length > 0 && !selectedTag) {
        setSelectedTag(uniqueTags[0]);
      }
      
      setData(result.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getChartData = () => {
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
      {selectedTag && data.filter(item => item.tag === selectedTag).length > 0 && (
        <div className="histogram-info">
          <p>Count: {data.filter(item => item.tag === selectedTag)[0].num}</p>
          <p>Sum: {data.filter(item => item.tag === selectedTag)[0].sum.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
