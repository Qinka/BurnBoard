// Chart size types and constants

export type ChartSize = 'small' | 'medium' | 'large' | 'auto';

export const CHART_HEIGHTS: Record<ChartSize, number | 'auto'> = {
  small: 150,
  medium: 250,
  large: 400,
  auto: 'auto',
};

// Calculate auto height based on number of data points
export const getAutoHeight = (dataLength: number): number => {
  if (dataLength <= 10) return 150;
  if (dataLength <= 50) return 200;
  if (dataLength <= 100) return 250;
  return 300;
};

// Calculate auto height for histogram (fixed data size - 3 bars)
export const getHistogramAutoHeight = (): number => {
  return 200; // Histogram always has 3 bars (Min, Max, Mean)
};
