import { useState } from 'react'
import ScalarChart from './components/ScalarChart'
import HistogramChart from './components/HistogramChart'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('scalars')

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔥 BurnBoard</h1>
        <p>TensorBoard-compatible visualization dashboard</p>
      </header>
      
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
        {activeTab === 'scalars' && <ScalarChart />}
        {activeTab === 'histograms' && <HistogramChart />}
      </main>
      
      <footer className="app-footer">
        <p>BurnBoard - Open Source TensorBoard Alternative</p>
      </footer>
    </div>
  )
}

export default App
