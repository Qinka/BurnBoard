import { useState, useRef, useEffect, useCallback } from 'react'
import ScalarChart, { ScalarChartHandle } from './components/ScalarChart'
import HistogramChart, { HistogramChartHandle } from './components/HistogramChart'
import { getRunColor } from './utils/colors'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'scalars' | 'histograms'>('scalars')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [runs, setRuns] = useState<string[]>([])
  const [visibleRuns, setVisibleRuns] = useState<Set<string>>(new Set())

  const scalarChartRef = useRef<ScalarChartHandle>(null)
  const histogramChartRef = useRef<HistogramChartHandle>(null)

  // When runs change, make all runs visible by default
  const handleRunsChange = useCallback((newRuns: string[]) => {
    setRuns(newRuns)
    setVisibleRuns(prev => {
      // Add new runs to visible set, keep existing visibility state
      const updated = new Set(prev)
      newRuns.forEach(run => {
        if (!prev.has(run) && !runs.includes(run)) {
          // This is a new run, make it visible by default
          updated.add(run)
        }
      })
      // If this is the first load, make all visible
      if (prev.size === 0 && newRuns.length > 0) {
        return new Set(newRuns)
      }
      return updated
    })
  }, [runs])

  // Toggle run visibility
  const toggleRunVisibility = (run: string) => {
    setVisibleRuns(prev => {
      const updated = new Set(prev)
      if (updated.has(run)) {
        updated.delete(run)
      } else {
        updated.add(run)
      }
      return updated
    })
  }

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

  // Update document title based on active tab
  useEffect(() => {
    const tabName = activeTab === 'scalars' ? 'Scalars' : 'Histograms'
    document.title = `${tabName} - BurnBoard`
  }, [activeTab])

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
          {lastRefresh && (
            <span className="last-refresh">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* Tab Navigation - Below Header */}
      <nav className="header-tabs">
        <button
          className={`header-tab ${activeTab === 'scalars' ? 'active' : ''}`}
          onClick={() => setActiveTab('scalars')}
        >
          Scalars
        </button>
        <button
          className={`header-tab ${activeTab === 'histograms' ? 'active' : ''}`}
          onClick={() => setActiveTab('histograms')}
        >
          Histograms
        </button>
      </nav>

      {/* Main Body - Sidebar + Content */}
      <div className="app-body">
        {/* Sidebar for Runs */}
        {runs.length > 0 && (
          <aside className="app-sidebar">
            <div className="sidebar-runs">
              <h4 className="sidebar-section-title">Runs</h4>
              <div className="runs-list">
                {runs.map((run, index) => {
                  const isVisible = visibleRuns.has(run)
                  return (
                    <label
                      key={run}
                      className={`run-item run-item-toggle ${isVisible ? 'run-visible' : 'run-hidden'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleRunVisibility(run)}
                        className="run-checkbox"
                      />
                      <span
                        className="run-color-dot"
                        style={{ backgroundColor: isVisible ? getRunColor(index) : '#666' }}
                      />
                      <span className="run-name">{run}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className={`app-main ${runs.length === 0 ? 'no-sidebar' : ''}`}>
          {activeTab === 'scalars' && <ScalarChart ref={scalarChartRef} onRunsChange={handleRunsChange} visibleRuns={visibleRuns} />}
          {activeTab === 'histograms' && <HistogramChart ref={histogramChartRef} onRunsChange={handleRunsChange} visibleRuns={visibleRuns} />}
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
