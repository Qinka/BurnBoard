import { useState, useEffect } from 'react';
import './SettingsModal.css';

export type SamplingMode = 'auto' | 'low' | 'medium' | 'high' | 'maximum' | 'custom';

export interface PerformanceSettings {
  scalarMaxPoints: number;
  histogramMaxPoints: number;
  autoAdjust: boolean;
  mode: SamplingMode;
  refreshInterval: number; // in seconds
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PerformanceSettings;
  currentScalarPoints?: number; // Real-time value shown in auto mode
  currentHistogramPoints?: number; // Real-time value shown in auto mode
  onSettingsChange: (settings: PerformanceSettings) => void;
}

const PRESET_OPTIONS = [
  { mode: 'auto' as SamplingMode, label: '自动', scalar: 200, histogram: 100 },
  { mode: 'low' as SamplingMode, label: '低 (100/50)', scalar: 100, histogram: 50 },
  { mode: 'medium' as SamplingMode, label: '中 (200/100)', scalar: 200, histogram: 100 },
  { mode: 'high' as SamplingMode, label: '高 (500/200)', scalar: 500, histogram: 200 },
  { mode: 'maximum' as SamplingMode, label: '最高 (1000/500)', scalar: 1000, histogram: 500 },
  { mode: 'custom' as SamplingMode, label: '自定义', scalar: 200, histogram: 100 },
];

const REFRESH_INTERVALS = [
  { value: 1, label: '1秒', scalarMultiplier: 0.5, histogramMultiplier: 0.5 },
  { value: 5, label: '5秒', scalarMultiplier: 1.0, histogramMultiplier: 1.0 },
  { value: 10, label: '10秒', scalarMultiplier: 1.5, histogramMultiplier: 1.5 },
  { value: 30, label: '30秒', scalarMultiplier: 2.5, histogramMultiplier: 2.5 },
  { value: 60, label: '60秒', scalarMultiplier: 4.0, histogramMultiplier: 4.0 },
];

// Helper function to calculate adjusted sampling points based on refresh interval
function getAdjustedSamplingPoints(baseScalar: number, baseHistogram: number, refreshInterval: number) {
  const intervalConfig = REFRESH_INTERVALS.find(i => i.value === refreshInterval);
  if (!intervalConfig) {
    return { scalar: baseScalar, histogram: baseHistogram };
  }
  
  return {
    scalar: Math.round(baseScalar * intervalConfig.scalarMultiplier),
    histogram: Math.round(baseHistogram * intervalConfig.histogramMultiplier),
  };
}

function SettingsModal({ 
  isOpen, 
  onClose, 
  settings, 
  currentScalarPoints,
  currentHistogramPoints,
  onSettingsChange 
}: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState(settings);

  // Update local settings when modal opens with new settings
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleCancel = () => {
    // Reset to original settings without saving
    setLocalSettings(settings);
    onClose();
  };

  const handleModeChange = (mode: SamplingMode, baseScalar: number, baseHistogram: number) => {
    // Apply refresh interval multiplier to get adjusted sampling points
    const adjusted = getAdjustedSamplingPoints(baseScalar, baseHistogram, localSettings.refreshInterval);
    
    setLocalSettings({
      ...localSettings,
      mode,
      scalarMaxPoints: adjusted.scalar,
      histogramMaxPoints: adjusted.histogram,
      autoAdjust: mode === 'auto',
    });
  };

  const handleRefreshIntervalChange = (newInterval: number) => {
    // When refresh interval changes, adjust sampling points for non-custom modes
    if (localSettings.mode !== 'custom') {
      const preset = PRESET_OPTIONS.find(p => p.mode === localSettings.mode);
      if (preset) {
        const adjusted = getAdjustedSamplingPoints(preset.scalar, preset.histogram, newInterval);
        setLocalSettings({
          ...localSettings,
          refreshInterval: newInterval,
          scalarMaxPoints: adjusted.scalar,
          histogramMaxPoints: adjusted.histogram,
        });
        return;
      }
    }
    
    // For custom mode, just update the interval
    setLocalSettings({
      ...localSettings,
      refreshInterval: newInterval,
    });
  };

  const isCustomMode = localSettings.mode === 'custom';
  const isAutoMode = localSettings.mode === 'auto';

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={handleCancel}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>性能设置 / Performance Settings</h2>
          <button className="settings-close-btn" onClick={handleCancel}>×</button>
        </div>
        
        <div className="settings-modal-content">
          <div className="settings-section">
            <h3>采样模式</h3>
            <p className="settings-description">
              选择采样模式。自动模式根据网络情况调整，预设模式使用固定值（根据刷新间隔自动调整），自定义模式允许精确设置。
            </p>
            
            <div className="settings-presets">
              <div className="preset-buttons">
                {PRESET_OPTIONS.map((preset) => (
                  <button
                    key={preset.mode}
                    className={`preset-btn ${
                      localSettings.mode === preset.mode ? 'active' : ''
                    }`}
                    onClick={() => handleModeChange(preset.mode, preset.scalar, preset.histogram)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-input-group">
              <label>
                标量图表采样点数:
                <input
                  type="number"
                  min="50"
                  max="5000"
                  step="50"
                  value={isAutoMode && currentScalarPoints !== undefined ? currentScalarPoints : localSettings.scalarMaxPoints}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      scalarMaxPoints: parseInt(e.target.value) || 200,
                    })
                  }
                  disabled={!isCustomMode}
                />
                <span className="input-hint">
                  {isAutoMode ? 
                    `实时: ${currentScalarPoints !== undefined ? currentScalarPoints : localSettings.scalarMaxPoints} 点/指标 (自适应)` : 
                    `当前: ${localSettings.scalarMaxPoints} 点/指标`
                  }
                </span>
              </label>
            </div>

            <div className="settings-input-group">
              <label>
                直方图采样点数:
                <input
                  type="number"
                  min="50"
                  max="1000"
                  step="50"
                  value={isAutoMode && currentHistogramPoints !== undefined ? currentHistogramPoints : localSettings.histogramMaxPoints}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      histogramMaxPoints: parseInt(e.target.value) || 100,
                    })
                  }
                  disabled={!isCustomMode}
                />
                <span className="input-hint">
                  {isAutoMode ? 
                    `实时: ${currentHistogramPoints !== undefined ? currentHistogramPoints : localSettings.histogramMaxPoints} 点/指标 (自适应)` : 
                    `当前: ${localSettings.histogramMaxPoints} 点/指标`
                  }
                </span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>更新速率</h3>
            <p className="settings-description">
              设置自动刷新的时间间隔。
            </p>
            
            <div className="settings-input-group">
              <label>
                刷新间隔:
                <select
                  value={localSettings.refreshInterval}
                  onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
                  className="refresh-interval-select"
                >
                  {REFRESH_INTERVALS.map((interval) => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="settings-info" style={{ marginTop: '8px', fontSize: '12px' }}>
                ℹ️ 刷新间隔越长，采样点数自动增加以获取更多数据
              </p>
            </div>
          </div>

          <div className="settings-impact">
            <h4>当前配置</h4>
            <div className="impact-grid">
              <div className="impact-item">
                <span className="impact-label">模式:</span>
                <span className="impact-value">
                  {PRESET_OPTIONS.find(p => p.mode === localSettings.mode)?.label || '未知'}
                </span>
              </div>
              <div className="impact-item">
                <span className="impact-label">刷新间隔:</span>
                <span className="impact-value">
                  {localSettings.refreshInterval}秒
                </span>
              </div>
              <div className="impact-item">
                <span className="impact-label">标量采样:</span>
                <span className="impact-value">
                  {isAutoMode && currentScalarPoints !== undefined ? currentScalarPoints : localSettings.scalarMaxPoints} 点
                </span>
              </div>
              <div className="impact-item">
                <span className="impact-label">直方图采样:</span>
                <span className="impact-value">
                  {isAutoMode && currentHistogramPoints !== undefined ? currentHistogramPoints : localSettings.histogramMaxPoints} 点
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-modal-footer">
          <button className="settings-btn settings-btn-secondary" onClick={handleCancel}>
            取消
          </button>
          <button className="settings-btn settings-btn-primary" onClick={handleSave}>
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
