import { useState, useRef, useEffect, useCallback } from 'react'
import ScalarChart, { ScalarChartHandle } from './components/ScalarChart'
import HistogramChart, { HistogramChartHandle } from './components/HistogramChart'
import { ChartSize } from './types/chartTypes'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'scalars' | 'histograms'>('scalars')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [chartSize, setChartSize] = useState<ChartSize>('medium')
  
  const scalarChartRef = useRef<ScalarChartHandle>(null)
  const histogramChartRef = useRef<HistogramChartHandle>(null)

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
      {/* Header - TensorBoard Style */}
      <header className="app-header">
        <div className="header-brand">
          <span className="logo">🔥</span>
          <h1>BurnBoard</h1>
          <span className="tagline">TensorBoard-compatible visualization</span>
        </div>
        
        <div className="refresh-controls">
          <button 
            className="refresh-button"
            onClick={handleRefresh}
            title="Refresh data"
          >
            ↻ Refresh
          </button>
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto
          </label>
          <label className="interval-selector">
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
          <label className="chart-size-selector" title="Chart size">
            <span className="size-icon">📐</span>
            <select
              value={chartSize}
              onChange={(e) => setChartSize(e.target.value as ChartSize)}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="auto">Auto</option>
            </select>
          </label>
          {lastRefresh && (
            <span className="last-refresh">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>
      
      {/* Main Body - Sidebar + Content */}
      <div className="app-body">
        {/* Sidebar Navigation */}
        <aside className="app-sidebar">
          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeTab === 'scalars' ? 'active' : ''}`}
              onClick={() => setActiveTab('scalars')}
            >
              <span className="nav-icon">📈</span>
              Scalars
            </button>
            <button 
              className={`nav-item ${activeTab === 'histograms' ? 'active' : ''}`}
              onClick={() => setActiveTab('histograms')}
            >
              <span className="nav-icon">📊</span>
              Histograms
            </button>
          </nav>
        </aside>
        
        {/* Main Content Area */}
        <main className="app-main">
          {activeTab === 'scalars' && <ScalarChart ref={scalarChartRef} chartSize={chartSize} />}
          {activeTab === 'histograms' && <HistogramChart ref={histogramChartRef} chartSize={chartSize} />}
        </main>
      </div>
      
      {/* Footer */}
      <footer className="app-footer">
        <p>BurnBoard — Open Source TensorBoard Alternative</p>
      </footer>
    </div>
  )
}

export default App
