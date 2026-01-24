import { useState, useRef, useEffect, useCallback } from 'react'
import ScalarChart from './components/ScalarChart'
import HistogramChart from './components/HistogramChart'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('scalars')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5)
  const [lastRefresh, setLastRefresh] = useState(null)
  
  const scalarChartRef = useRef(null)
  const histogramChartRef = useRef(null)

  const handleRefresh = useCallback(() => {
    if (activeTab === 'scalars' && scalarChartRef.current) {
      scalarChartRef.current.refresh()
    } else if (activeTab === 'histograms' && histogramChartRef.current) {
      histogramChartRef.current.refresh()
    }
    setLastRefresh(new Date())
  }, [activeTab])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const intervalId = setInterval(() => {
      handleRefresh()
    }, refreshInterval * 1000)

    return () => clearInterval(intervalId)
  }, [autoRefresh, refreshInterval, handleRefresh])

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔥 BurnBoard</h1>
        <p>TensorBoard-compatible visualization dashboard</p>
      </header>
      
      <div className="refresh-controls">
        <button 
          className="refresh-button"
          onClick={handleRefresh}
          title="Refresh data"
        >
          🔄 Refresh
        </button>
        <label className="auto-refresh-toggle">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh
        </label>
        <label className="interval-selector">
          Interval:
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
          >
            <option value={1}>1s</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
        </label>
        {lastRefresh && (
          <span className="last-refresh">
            Last: {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      <nav className="app-nav">
        <button 
          className={activeTab === 'scalars' ? 'active' : ''}
          onClick={() => setActiveTab('scalars')}
        >
          Scalars
        </button>
        <button 
          className={activeTab === 'histograms' ? 'active' : ''}
          onClick={() => setActiveTab('histograms')}
        >
          Histograms
        </button>
      </nav>
      
      <main className="app-main">
        {activeTab === 'scalars' && <ScalarChart ref={scalarChartRef} />}
        {activeTab === 'histograms' && <HistogramChart ref={histogramChartRef} />}
      </main>
      
      <footer className="app-footer">
        <p>BurnBoard - Open Source TensorBoard Alternative</p>
      </footer>
    </div>
  )
}

export default App
