import { useState, useEffect, useRef } from 'react';
import { PerformanceSettings, SamplingMode } from '../components/SettingsModal';

interface NetworkMetrics {
  latency: number;
  timestamp: number;
}

const LATENCY_THRESHOLD_SLOW = 1000; // 1 second
const LATENCY_THRESHOLD_MEDIUM = 500; // 500ms
const METRICS_HISTORY_SIZE = 10;

/**
 * Hook to manage performance settings with network-adaptive sampling
 */
export function usePerformanceSettings() {
  const [settings, setSettings] = useState<PerformanceSettings>(() => {
    const saved = localStorage.getItem('burnboard-performance-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure mode field exists (migration from old version)
        if (!parsed.mode) {
          parsed.mode = parsed.autoAdjust ? 'auto' : 'medium';
        }
        // Ensure refreshInterval exists
        if (!parsed.refreshInterval) {
          parsed.refreshInterval = 5;
        }
        return parsed;
      } catch {
        // Fall back to defaults if parsing fails
      }
    }
    return {
      scalarMaxPoints: 200,
      histogramMaxPoints: 100,
      autoAdjust: true,
      mode: 'auto' as SamplingMode,
      refreshInterval: 5,
    };
  });

  const metricsHistory = useRef<NetworkMetrics[]>([]);
  const baseSettings = useRef<PerformanceSettings>(settings);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('burnboard-performance-settings', JSON.stringify(settings));
    // Update base settings when user manually changes them (not during auto-adjust)
    // We track this by checking if we're not in the middle of auto-adjustment
  }, [settings]);

  // Separate effect to update base settings when auto-adjust is disabled
  useEffect(() => {
    if (!settings.autoAdjust) {
      baseSettings.current = settings;
    }
  }, [settings.autoAdjust, settings.scalarMaxPoints, settings.histogramMaxPoints]);

  /**
   * Record network latency for adaptive adjustment
   */
  const recordLatency = (latency: number) => {
    if (!settings.autoAdjust || settings.mode !== 'auto') return;

    metricsHistory.current.push({
      latency,
      timestamp: Date.now(),
    });

    // Keep only recent metrics
    if (metricsHistory.current.length > METRICS_HISTORY_SIZE) {
      metricsHistory.current.shift();
    }

    // Calculate average latency
    const avgLatency =
      metricsHistory.current.reduce((sum, m) => sum + m.latency, 0) /
      metricsHistory.current.length;

    // Adjust sampling based on network performance
    if (avgLatency > LATENCY_THRESHOLD_SLOW) {
      // Very slow network - reduce to minimum
      setSettings((prev) => ({
        ...prev,
        scalarMaxPoints: Math.min(baseSettings.current.scalarMaxPoints, 100),
        histogramMaxPoints: Math.min(baseSettings.current.histogramMaxPoints, 50),
      }));
    } else if (avgLatency > LATENCY_THRESHOLD_MEDIUM) {
      // Medium network - moderate reduction
      setSettings((prev) => ({
        ...prev,
        scalarMaxPoints: Math.min(baseSettings.current.scalarMaxPoints, 150),
        histogramMaxPoints: Math.min(baseSettings.current.histogramMaxPoints, 75),
      }));
    } else {
      // Good network - use base settings
      setSettings((prev) => ({
        ...prev,
        scalarMaxPoints: baseSettings.current.scalarMaxPoints,
        histogramMaxPoints: baseSettings.current.histogramMaxPoints,
      }));
    }
  };

  /**
   * Update settings manually (from settings modal)
   */
  const updateSettings = (newSettings: PerformanceSettings) => {
    baseSettings.current = newSettings;
    setSettings(newSettings);
    metricsHistory.current = []; // Reset metrics when settings change
    // Immediately save to localStorage
    localStorage.setItem('burnboard-performance-settings', JSON.stringify(newSettings));
  };

  return {
    settings,
    updateSettings,
    recordLatency,
  };
}
