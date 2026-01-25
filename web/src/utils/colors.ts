/**
 * Color palette for different runs
 */
export const RUN_COLORS = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
];

/**
 * Get the color for a run at a given index
 */
export const getRunColor = (index: number): string => {
  return RUN_COLORS[index % RUN_COLORS.length];
};
