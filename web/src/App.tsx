import { useState, useRef, useEffect, useCallback } from 'react'
import ScalarChart, { ScalarChartHandle } from './components/ScalarChart'
import HistogramChart, { HistogramChartHandle } from './components/HistogramChart'
import SettingsModal from './components/SettingsModal'
import { getRunColor } from './utils/colors'
import { usePerformanceSettings } from './utils/performanceSettings'
import './App.css'

type Theme = 'light' | 'dark'

function App() {
  const [activeTab, setActiveTab] = useState<'scalars' | 'histograms'>('scalars')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [runs, setRuns] = useState<string[]>([])
  const [visibleRuns, setVisibleRuns] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage or default to light
    const savedTheme = localStorage.getItem('burnboard-theme') as Theme | null
    return savedTheme || 'light'
  })

  const { settings, updateSettings, recordLatency } = usePerformanceSettings()
  const scalarChartRef = useRef<ScalarChartHandle>(null)
  const histogramChartRef = useRef<HistogramChartHandle>(null)

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('burnboard-theme', theme)
  }, [theme])

  // Toggle theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

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
      {/* Header - Horizontal Layout: Left (Title) | Center (Tabs) | Right (Controls) */}
      <header className="app-header">
        {/* Left: Brand */}
        <div className="header-left">
          <div className="header-brand">
            <span className="logo">🔥</span>
            <h1>BurnBoard</h1>
          </div>
          <span className="tagline">TensorBoard-compatible visualization</span>
        </div>

        {/* Center: Tab Navigation */}
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

        {/* Right: Refresh Controls */}
        <div className="header-right">
          <button
            className="settings-button"
            onClick={() => setShowSettings(true)}
            title="Performance Settings / 性能设置"
          >
            ⚙️
          </button>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
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
          <select
            className="interval-select"
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
          {lastRefresh && (
            <span className="last-refresh">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

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
          {activeTab === 'scalars' && (
            <ScalarChart
              ref={scalarChartRef}
              onRunsChange={handleRunsChange}
              visibleRuns={visibleRuns}
              maxPoints={settings.scalarMaxPoints}
              onLatencyRecord={recordLatency}
            />
          )}
          {activeTab === 'histograms' && (
            <HistogramChart
              ref={histogramChartRef}
              onRunsChange={handleRunsChange}
              visibleRuns={visibleRuns}
              maxPoints={settings.histogramMaxPoints}
              onLatencyRecord={recordLatency}
            />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        currentScalarPoints={settings.scalarMaxPoints}
        currentHistogramPoints={settings.histogramMaxPoints}
        onSettingsChange={(newSettings) => {
          updateSettings(newSettings);
          setRefreshInterval(newSettings.refreshInterval);
        }}
      />

      {/* Footer */}
      <footer className="app-footer">
        <p>BurnBoard — Open Source TensorBoard Alternative</p>
      </footer>
    </div>
  )
}

export default App
