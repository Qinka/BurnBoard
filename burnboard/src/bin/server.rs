use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use burnboard::{Event, EventFileParser};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tower_http::services::ServeDir;
use tracing::{info, warn, Level};
use tracing_subscriber;
use clap::Parser;


#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct ServerArgs {
    /// Directory where TensorBoard logs are stored
    #[arg(long, default_value = "./logs")]
    log_dir: PathBuf,

    /// Bind address for the server
    #[arg(long, default_value = "127.0.0.1:6009")]
    bind_addr: String,

    /// Interval in seconds for reloading events from the log directory
    #[arg(long, default_value = "5")]
    reload_interval: u64,
}


// Event with run information
#[derive(Clone)]
struct EventWithRun {
    event: Event,
    run: String,
}

// State shared across requests
#[derive(Clone)]
struct AppState {
    events: Arc<RwLock<Vec<EventWithRun>>>,
    #[allow(dead_code)]
    log_dir: PathBuf,
}

// Query parameters for filtering
#[derive(Deserialize)]
struct DataQuery {
    /// Filter by specific tags (comma-separated)
    tags: Option<String>,
    /// Filter by specific runs (comma-separated)
    runs: Option<String>,
    /// Maximum number of data points per tag (for sampling)
    max_points: Option<usize>,
}

// Response types
#[derive(Serialize, Deserialize, Clone)]
struct ScalarData {
    tag: String,
    step: i64,
    wall_time: f64,
    value: f32,
    run: String,  // The run (subdirectory) this data belongs to
}

#[derive(Serialize, Deserialize, Clone)]
struct HistogramData {
    tag: String,
    step: i64,
    wall_time: f64,
    min: f64,
    max: f64,
    num: f64,
    sum: f64,
    sum_squares: f64,
    run: String,  // The run (subdirectory) this data belongs to
}

#[derive(Serialize, Deserialize)]
struct ApiResponse<T> {
    data: T,
    count: usize,
}

// Error handling
struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Internal server error: {}", self.0),
        )
            .into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

/// Sample data points using Largest-Triangle-Three-Buckets algorithm for visual preservation
/// This reduces the number of points while maintaining the visual characteristics of the data
fn sample_data<T, F>(data: Vec<T>, max_points: usize, get_x: F) -> Vec<T>
where
    F: Fn(&T) -> i64,
    T: Clone,
{
    if data.len() <= max_points || max_points < 3 {
        return data;
    }

    let mut sampled = Vec::with_capacity(max_points);
    
    // Always include first point
    sampled.push(data[0].clone());
    
    let bucket_size = (data.len() - 2) as f64 / (max_points - 2) as f64;
    let mut a_index = 0;
    
    for i in 0..(max_points - 2) {
        // Calculate point average for next bucket (for next iteration)
        let avg_range_start = ((i + 1) as f64 * bucket_size).floor() as usize + 1;
        let avg_range_end = ((i + 2) as f64 * bucket_size).floor() as usize + 1;
        let avg_range_end = avg_range_end.min(data.len());
        
        let avg_x = if avg_range_end > avg_range_start {
            let sum: i64 = (avg_range_start..avg_range_end)
                .map(|idx| get_x(&data[idx]))
                .sum();
            sum / (avg_range_end - avg_range_start) as i64
        } else {
            get_x(&data[data.len() - 1])
        };
        
        // Get current bucket range
        let range_start = (i as f64 * bucket_size).floor() as usize + 1;
        let range_end = ((i + 1) as f64 * bucket_size).floor() as usize + 1;
        
        // Find point in bucket with largest triangle area
        let point_a_x = get_x(&data[a_index]) as f64;
        
        let mut max_area = -1.0;
        let mut max_area_point = range_start;
        
        for idx in range_start..range_end.min(data.len()) {
            let point_x = get_x(&data[idx]) as f64;
            // Calculate triangle area
            let area = ((point_a_x - avg_x as f64) * (point_x - point_a_x)).abs();
            
            if area > max_area {
                max_area = area;
                max_area_point = idx;
            }
        }
        
        sampled.push(data[max_area_point].clone());
        a_index = max_area_point;
    }
    
    // Always include last point
    sampled.push(data[data.len() - 1].clone());
    
    sampled
}

// Handler: Get scalar data
async fn get_scalars(
    State(state): State<AppState>,
    Query(query): Query<DataQuery>,
) -> Result<Json<ApiResponse<Vec<ScalarData>>>, AppError> {
    let events = state.events.read().await;
    
    // Parse filter parameters
    let tag_filter: Option<Vec<String>> = query.tags.as_ref().map(|tags| 
        tags.split(',').map(|s| s.trim().to_string()).collect()
    );
    let run_filter: Option<Vec<String>> = query.runs.as_ref().map(|runs| 
        runs.split(',').map(|s| s.trim().to_string()).collect()
    );
    
    // Group scalars by tag and run for sampling
    let mut grouped_scalars: std::collections::HashMap<(String, String), Vec<ScalarData>> = std::collections::HashMap::new();

    for event_with_run in events.iter() {
        // Apply run filter
        if let Some(ref runs) = run_filter {
            if !runs.contains(&event_with_run.run) {
                continue;
            }
        }
        
        if let Some(burnboard::proto::event::What::Summary(summary)) = &event_with_run.event.what {
            for value in &summary.value {
                // Apply tag filter
                if let Some(ref tags) = tag_filter {
                    if !tags.contains(&value.tag) {
                        continue;
                    }
                }
                
                if let Some(burnboard::proto::summary::value::Value::SimpleValue(v)) = &value.value
                {
                    let key = (value.tag.clone(), event_with_run.run.clone());
                    grouped_scalars.entry(key).or_insert_with(Vec::new).push(ScalarData {
                        tag: value.tag.clone(),
                        step: event_with_run.event.step,
                        wall_time: event_with_run.event.wall_time,
                        value: *v,
                        run: event_with_run.run.clone(),
                    });
                }
            }
        }
    }
    
    // Apply sampling and collect results
    let mut scalars = Vec::new();
    let max_points = query.max_points.unwrap_or(usize::MAX);
    
    for (_, mut data) in grouped_scalars {
        // Sort by step for consistent sampling
        data.sort_by_key(|d| d.step);
        
        // Apply sampling if needed
        let sampled_data = if data.len() > max_points {
            sample_data(data, max_points, |d| d.step)
        } else {
            data
        };
        
        scalars.extend(sampled_data);
    }

    let count = scalars.len();
    Ok(Json(ApiResponse {
        data: scalars,
        count,
    }))
}

// Handler: Get histogram data
async fn get_histograms(
    State(state): State<AppState>,
    Query(query): Query<DataQuery>,
) -> Result<Json<ApiResponse<Vec<HistogramData>>>, AppError> {
    let events = state.events.read().await;
    
    // Parse filter parameters
    let tag_filter: Option<Vec<String>> = query.tags.as_ref().map(|tags| 
        tags.split(',').map(|s| s.trim().to_string()).collect()
    );
    let run_filter: Option<Vec<String>> = query.runs.as_ref().map(|runs| 
        runs.split(',').map(|s| s.trim().to_string()).collect()
    );
    
    // Group histograms by tag and run for sampling
    let mut grouped_histograms: std::collections::HashMap<(String, String), Vec<HistogramData>> = std::collections::HashMap::new();

    for event_with_run in events.iter() {
        // Apply run filter
        if let Some(ref runs) = run_filter {
            if !runs.contains(&event_with_run.run) {
                continue;
            }
        }
        
        if let Some(burnboard::proto::event::What::Summary(summary)) = &event_with_run.event.what {
            for value in &summary.value {
                // Apply tag filter
                if let Some(ref tags) = tag_filter {
                    if !tags.contains(&value.tag) {
                        continue;
                    }
                }
                
                if let Some(burnboard::proto::summary::value::Value::Histo(h)) = &value.value {
                    let key = (value.tag.clone(), event_with_run.run.clone());
                    grouped_histograms.entry(key).or_insert_with(Vec::new).push(HistogramData {
                        tag: value.tag.clone(),
                        step: event_with_run.event.step,
                        wall_time: event_with_run.event.wall_time,
                        min: h.min,
                        max: h.max,
                        num: h.num,
                        sum: h.sum,
                        sum_squares: h.sum_squares,
                        run: event_with_run.run.clone(),
                    });
                }
            }
        }
    }
    
    // Apply sampling and collect results
    let mut histograms = Vec::new();
    let max_points = query.max_points.unwrap_or(usize::MAX);
    
    for (_, mut data) in grouped_histograms {
        // Sort by step for consistent sampling
        data.sort_by_key(|d| d.step);
        
        // Apply sampling if needed
        let sampled_data = if data.len() > max_points {
            sample_data(data, max_points, |d| d.step)
        } else {
            data
        };
        
        histograms.extend(sampled_data);
    }

    let count = histograms.len();
    Ok(Json(ApiResponse {
        data: histograms,
        count,
    }))
}

// Handler: Health check
async fn health_check() -> &'static str {
    "OK"
}

/// Load events from a directory recursively.
/// Returns a Vec of EventWithRun where each entry contains an Event and its run name
/// (the relative path from log_dir).
fn load_events_from_dir(log_dir: &PathBuf) -> Vec<EventWithRun> {
    let mut events = Vec::new();
    
    if !log_dir.exists() {
        return events;
    }
    
    // Recursively collect all directories to scan (including the root)
    fn collect_dirs(dir: &PathBuf, dirs: &mut Vec<PathBuf>) {
        dirs.push(dir.clone());
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    collect_dirs(&path, dirs);
                }
            }
        }
    }
    
    let mut dirs_to_scan = Vec::new();
    collect_dirs(log_dir, &mut dirs_to_scan);
    
    // Scan each directory for .tfevents files
    for dir in dirs_to_scan {
        // Calculate the run name as relative path from log_dir
        let run_name = if dir == *log_dir {
            ".".to_string()  // Root directory
        } else {
            dir.strip_prefix(log_dir)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        };
        
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .and_then(|s| s.split('.').find(|&s| s == "tfevents"))
                    .is_some()
                {
                    match EventFileParser::open(&path) {
                        Ok(mut parser) => match parser.read_all_events() {
                            Ok(file_events) => {
                                for event in file_events {
                                    events.push(EventWithRun {
                                        event,
                                        run: run_name.clone(),
                                    });
                                }
                            }
                            Err(e) => warn!("Failed to read events from {:?}: {}", path, e),
                        },
                        Err(e) => warn!("Failed to open event file {:?}: {}", path, e),
                    }
                }
            }
        }
    }
    
    events
}

/// Background task to periodically reload events from the log directory
async fn reload_events_task(state: AppState, log_dir: PathBuf, interval_secs: u64) {
    let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
    
    // Skip the first immediate tick to avoid reloading right after startup
    interval.tick().await;
    
    loop {
        interval.tick().await;
        
        let new_events = load_events_from_dir(&log_dir);
        let new_count = new_events.len();
        
        let mut events = state.events.write().await;
        let old_count = events.len();
        
        *events = new_events;
        
        if new_count != old_count {
            info!("Reloaded events: {} -> {} events", old_count, new_count);
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    let args = ServerArgs::parse();
    info!("Log directory: {:?}", args.log_dir);
    info!("Bind address: {}", args.bind_addr);


    info!("Starting BurnBoard server...");

    // Create application state
    let state = AppState {
        events: Arc::new(RwLock::new(Vec::new())),
        log_dir: args.log_dir.clone(),
    };

    // Initial load of events from log directory
    {
        info!("Loading events from {:?}", args.log_dir);
        let initial_events = load_events_from_dir(&args.log_dir);
        let mut events = state.events.write().await;
        *events = initial_events;
        info!("Total events loaded: {}", events.len());
    }

    // Spawn background task to periodically reload events
    let reload_state = state.clone();
    let reload_log_dir = args.log_dir.clone();
    let reload_interval = args.reload_interval;
    tokio::spawn(async move {
        reload_events_task(reload_state, reload_log_dir, reload_interval).await;
    });
    info!("Background reload task started (interval: {} seconds)", args.reload_interval);

    // Build the application router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/scalars", get(get_scalars))
        .route("/api/histograms", get(get_histograms))
        .fallback_service(ServeDir::new("assets/web"))
        .with_state(state);

    // Start the server
    info!("Server listening on {}", args.bind_addr);

    let listener = tokio::net::TcpListener::bind(&args.bind_addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
