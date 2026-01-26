import { useState, useEffect } from 'react';
import './SettingsModal.css';

export interface PerformanceSettings {
  scalarMaxPoints: number;
  histogramMaxPoints: number;
  autoAdjust: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PerformanceSettings;
  onSettingsChange: (settings: PerformanceSettings) => void;
}

const PRESET_OPTIONS = [
  { label: '低 (100/50)', scalar: 100, histogram: 50 },
  { label: '中 (200/100)', scalar: 200, histogram: 100 },
  { label: '高 (500/200)', scalar: 500, histogram: 200 },
  { label: '最高 (1000/500)', scalar: 1000, histogram: 500 },
];

function SettingsModal({ isOpen, onClose, settings, onSettingsChange }: SettingsModalProps) {
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

  const handlePreset = (scalar: number, histogram: number) => {
    setLocalSettings({
      ...localSettings,
      scalarMaxPoints: scalar,
      histogramMaxPoints: histogram,
    });
  };

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
            <h3>采样点数设置</h3>
            <p className="settings-description">
              设置每个指标的最大数据点数。更少的点数可提高渲染性能，但可能损失细节。
            </p>
            
            <div className="settings-presets">
              <label>预设配置：</label>
              <div className="preset-buttons">
                {PRESET_OPTIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    className={`preset-btn ${
                      localSettings.scalarMaxPoints === preset.scalar &&
                      localSettings.histogramMaxPoints === preset.histogram
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => handlePreset(preset.scalar, preset.histogram)}
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
                  value={localSettings.scalarMaxPoints}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      scalarMaxPoints: parseInt(e.target.value) || 200,
                    })
                  }
                />
                <span className="input-hint">当前: {localSettings.scalarMaxPoints} 点/指标</span>
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
                  value={localSettings.histogramMaxPoints}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      histogramMaxPoints: parseInt(e.target.value) || 100,
                    })
                  }
                />
                <span className="input-hint">当前: {localSettings.histogramMaxPoints} 点/指标</span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>自动调整</h3>
            <p className="settings-description">
              根据网络延迟和速度自动调整采样点数，以优化性能。
            </p>
            
            <div className="settings-checkbox-group">
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.autoAdjust}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      autoAdjust: e.target.checked,
                    })
                  }
                />
                <span>启用网络自适应采样</span>
              </label>
              {localSettings.autoAdjust && (
                <p className="settings-info">
                  ℹ️ 系统将监测API请求延迟，并自动降低采样点数以保持流畅性能。
                </p>
              )}
            </div>
          </div>

          <div className="settings-impact">
            <h4>性能影响估算</h4>
            <div className="impact-grid">
              <div className="impact-item">
                <span className="impact-label">标量数据量:</span>
                <span className="impact-value">
                  约 {Math.round(localSettings.scalarMaxPoints * 5 / 1000)} KB/次
                </span>
              </div>
              <div className="impact-item">
                <span className="impact-label">渲染点数:</span>
                <span className="impact-value">
                  {localSettings.scalarMaxPoints} 点/图表
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
