import { useEffect, useState, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import ResizableChart from './ResizableChart';
import { groupTagsByPrefix, getShortTagName } from '../utils/tagGrouping';
import { getRunColor } from '../utils/colors';

interface ImageData {
  tag: string;
  step: number;
  wall_time: number;
  height: number;
  width: number;
  colorspace: number;
  encoded_image: string;
  run: string;
}

interface ImageApiResponse {
  data: ImageData[];
}

interface ImageGalleryProps {
  onRunsChange?: (runs: string[]) => void;
  visibleRuns?: Set<string>;
  maxPoints?: number;
  onLatencyRecord?: (latency: number) => void;
}

export interface ImageGalleryHandle {
  refresh: () => void;
}

const ImageGallery = forwardRef<ImageGalleryHandle, ImageGalleryProps>(function ImageGallery({
  onRunsChange,
  visibleRuns,
  maxPoints = 50,
  onLatencyRecord
}, ref) {
  const [data, setData] = useState<ImageData[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [runs, setRuns] = useState<string[]>([]);
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<Map<string, number>>(new Map());

  const tagGroups = useMemo(() => groupTagsByPrefix(tags), [tags]);

  // Cache for data to avoid unnecessary refetches
  const [dataCache, setDataCache] = useState<{
    data: ImageData[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 5000; // 5 seconds

  const fetchImages = useCallback(async (forceRefresh = false) => {
    // Check cache if not forcing refresh
    if (!forceRefresh && dataCache && (Date.now() - dataCache.timestamp) < CACHE_DURATION) {
      const uniqueTags = [...new Set(dataCache.data.map(item => item.tag))].sort();
      setTags(uniqueTags);

      const uniqueRuns = [...new Set(dataCache.data.map(item => item.run))].sort();
      setRuns(uniqueRuns);

      setData(dataCache.data);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      const startTime = performance.now();
      const url = `/api/images?max_points=${maxPoints}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      const result: ImageApiResponse = await response.json();

      // Record latency for adaptive adjustment
      const endTime = performance.now();
      const latency = endTime - startTime;
      onLatencyRecord?.(latency);

      // Update cache
      setDataCache({
        data: result.data,
        timestamp: Date.now(),
      });

      const uniqueTags = [...new Set(result.data.map(item => item.tag))].sort();
      setTags(uniqueTags);

      const uniqueRuns = [...new Set(result.data.map(item => item.run))].sort();
      setRuns(uniqueRuns);

      setData(result.data);
      setLoading(false);
      setError(null);

      // Initialize selected steps to the latest step for each tag/run combination
      const newSelectedSteps = new Map<string, number>();
      for (const item of result.data) {
        const key = `${item.tag}|${item.run}`;
        const existing = newSelectedSteps.get(key);
        if (existing === undefined || item.step > existing) {
          newSelectedSteps.set(key, item.step);
        }
      }
      setSelectedSteps(prev => {
        // Only update steps that are not already selected
        const updated = new Map(prev);
        for (const [key, step] of newSelectedSteps) {
          if (!updated.has(key)) {
            updated.set(key, step);
          }
        }
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [dataCache, maxPoints, onLatencyRecord]);

  useEffect(() => {
    fetchImages(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent when runs change
  useEffect(() => {
    if (onRunsChange) {
      onRunsChange(runs);
    }
  }, [runs, onRunsChange]);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: () => fetchImages(true)
  }), [fetchImages]);

  const toggleCollapse = (tag: string) => {
    setCollapsedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // Get runs that have data for a specific tag (filtered by visibility)
  const getRunsForTag = (tag: string): string[] => {
    const tagData = data.filter(item => item.tag === tag);
    const allRuns = [...new Set(tagData.map(item => item.run))].sort();
    if (visibleRuns && visibleRuns.size > 0) {
      return allRuns.filter(run => visibleRuns.has(run));
    }
    return allRuns;
  };

  // Get all steps available for a tag/run combination
  const getStepsForTagAndRun = (tag: string, run: string): number[] => {
    return data
      .filter(item => item.tag === tag && item.run === run)
      .map(item => item.step)
      .sort((a, b) => a - b);
  };

  // Get image for a specific tag, run, and step
  const getImageForTagRunStep = (tag: string, run: string, step: number): ImageData | null => {
    return data.find(item => item.tag === tag && item.run === run && item.step === step) || null;
  };

  // Handle step selection change
  const handleStepChange = (tag: string, run: string, step: number) => {
    const key = `${tag}|${run}`;
    setSelectedSteps(prev => {
      const updated = new Map(prev);
      updated.set(key, step);
      return updated;
    });
  };

  // Get selected step for a tag/run combination
  const getSelectedStep = (tag: string, run: string): number | undefined => {
    const key = `${tag}|${run}`;
    return selectedSteps.get(key);
  };

  if (loading) {
    return <div className="loading">Loading image data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="chart-content-area">
      <div className="chart-header">
        <h2>Images</h2>
        {runs.length > 1 && (
          <div className="runs-legend">
            <span className="runs-label">Runs: </span>
            {runs.map((run, index) => (
              <span
                key={run}
                className="run-badge"
                style={{ backgroundColor: getRunColor(index) }}
              >
                {run}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="charts-list">
        {tagGroups.map((group) => {
          const isGroupCollapsed = collapsedGroups.has(group.name);
          const hasMultipleTags = group.tags.length > 1 || group.tags[0] !== group.name;

          return (
            <div key={group.name} className="metric-group">
              {hasMultipleTags && (
                <div
                  className="group-header"
                  onClick={() => toggleGroupCollapse(group.name)}
                  role="button"
                  aria-expanded={!isGroupCollapsed}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleGroupCollapse(group.name);
                    }
                  }}
                >
                  <span className="collapse-icon" aria-hidden="true">{isGroupCollapsed ? '▶' : '▼'}</span>
                  <h3 className="group-title">{group.name}</h3>
                  <span className="group-count">({group.tags.length})</span>
                </div>
              )}

              {!isGroupCollapsed && (
                <div className={hasMultipleTags ? "group-content" : ""}>
                  {group.tags.map((tag) => {
                    const isCollapsed = collapsedTags.has(tag);
                    const tagRuns = getRunsForTag(tag);
                    if (tagRuns.length === 0) return null;

                    const displayName = hasMultipleTags ? getShortTagName(tag, group.name) : tag;
                    const titleColor = tagRuns.length > 0
                      ? getRunColor(runs.indexOf(tagRuns[0]))
                      : getRunColor(0);

                    return (
                      <div key={tag} className="collapsible-chart">
                        <div
                          className="chart-title-bar"
                          onClick={() => toggleCollapse(tag)}
                          style={{ borderLeftColor: titleColor }}
                          role="button"
                          aria-expanded={!isCollapsed}
                          aria-controls={`image-content-${tag.replace(/\//g, '-')}`}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleCollapse(tag);
                            }
                          }}
                        >
                          <span className="collapse-icon" aria-hidden="true">{isCollapsed ? '▶' : '▼'}</span>
                          <h3 className="chart-title">
                            {displayName}
                          </h3>
                        </div>
                        {!isCollapsed && (
                          <div className="chart-content image-gallery-content" id={`image-content-${tag.replace(/\//g, '-')}`}>
                            <ResizableChart
                              tag={tag}
                              defaultHeight={300}
                              minHeight={150}
                              maxHeight={800}
                            >
                              {(height) => (
                                <div className="image-gallery-grid" style={{ minHeight: height }}>
                                  {tagRuns.map((run) => {
                                    const steps = getStepsForTagAndRun(tag, run);
                                    if (steps.length === 0) return null;

                                    const selectedStep = getSelectedStep(tag, run) ?? steps[steps.length - 1];
                                    const image = getImageForTagRunStep(tag, run, selectedStep);

                                    return (
                                      <div key={run} className="image-gallery-item" style={{ borderLeftColor: getRunColor(runs.indexOf(run)) }}>
                                        <div className="image-gallery-header">
                                          <span className="image-run-name">{run}</span>
                                          <div className="image-step-control">
                                            <label>
                                              Step:
                                              <select
                                                value={selectedStep}
                                                onChange={(e) => handleStepChange(tag, run, parseInt(e.target.value))}
                                                className="step-selector"
                                              >
                                                {steps.map((step) => (
                                                  <option key={step} value={step}>
                                                    {step}
                                                  </option>
                                                ))}
                                              </select>
                                            </label>
                                            <input
                                              type="range"
                                              min={0}
                                              max={steps.length - 1}
                                              value={steps.indexOf(selectedStep)}
                                              onChange={(e) => handleStepChange(tag, run, steps[parseInt(e.target.value)])}
                                              className="step-slider"
                                            />
                                          </div>
                                        </div>
                                        {image && (
                                          <div className="image-container">
                                            <img
                                              src={`data:image/png;base64,${image.encoded_image}`}
                                              alt={`${tag} - ${run} - Step ${selectedStep}`}
                                              style={{ maxWidth: '100%', maxHeight: height - 60 }}
                                            />
                                            <div className="image-info">
                                              <span>Size: {image.width}×{image.height}</span>
                                              <span>Step: {image.step}</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </ResizableChart>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {tags.length === 0 && (
        <div className="no-selection">No image data available</div>
      )}
    </div>
  );
});

export default ImageGallery;
