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

const ScalarChart = forwardRef(function ScalarChart(props, ref) {
  const [data, setData] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchScalars = useCallback(async () => {
    try {
      const response = await fetch('/api/scalars');
      if (!response.ok) {
        throw new Error('Failed to fetch scalars');
      }
      const result = await response.json();
      
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
      setError(err.message);
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

  const getChartData = () => {
    if (!selectedTag) return [];
    return data
      .filter(item => item.tag === selectedTag)
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
        <LineChart data={getChartData()}>
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
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#8884d8" 
            name={selectedTag}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export default ScalarChart;
