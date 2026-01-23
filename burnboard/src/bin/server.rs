use axum::{
    extract::State,
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


// State shared across requests
#[derive(Clone)]
struct AppState {
    events: Arc<RwLock<Vec<Event>>>,
    #[allow(dead_code)]
    log_dir: PathBuf,
}

// Response types
#[derive(Serialize, Deserialize)]
struct ScalarData {
    tag: String,
    step: i64,
    wall_time: f64,
    value: f32,
}

#[derive(Serialize, Deserialize)]
struct HistogramData {
    tag: String,
    step: i64,
    wall_time: f64,
    min: f64,
    max: f64,
    num: f64,
    sum: f64,
    sum_squares: f64,
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

// Handler: Get scalar data
async fn get_scalars(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<ScalarData>>>, AppError> {
    let events = state.events.read().await;
    let mut scalars = Vec::new();

    for event in events.iter() {
        if let Some(burnboard::proto::event::What::Summary(summary)) = &event.what {
            for value in &summary.value {
                if let Some(burnboard::proto::summary::value::Value::SimpleValue(v)) = &value.value
                {
                    scalars.push(ScalarData {
                        tag: value.tag.clone(),
                        step: event.step,
                        wall_time: event.wall_time,
                        value: *v,
                    });
                }
            }
        }
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
) -> Result<Json<ApiResponse<Vec<HistogramData>>>, AppError> {
    let events = state.events.read().await;
    let mut histograms = Vec::new();

    for event in events.iter() {
        if let Some(burnboard::proto::event::What::Summary(summary)) = &event.what {
            for value in &summary.value {
                if let Some(burnboard::proto::summary::value::Value::Histo(h)) = &value.value {
                    histograms.push(HistogramData {
                        tag: value.tag.clone(),
                        step: event.step,
                        wall_time: event.wall_time,
                        min: h.min,
                        max: h.max,
                        num: h.num,
                        sum: h.sum,
                        sum_squares: h.sum_squares,
                    });
                }
            }
        }
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

/// Load events from the log directory
fn load_events_from_dir(log_dir: &PathBuf) -> Vec<Event> {
    let mut events = Vec::new();
    
    if !log_dir.exists() {
        return events;
    }
    
    // Scan directory for .tfevents files
    if let Ok(entries) = std::fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .file_name()
                .and_then(|s| s.to_str())
                .and_then(|s| s.split('.').find(|&s| s == "tfevents"))
                .is_some()
            {
                match EventFileParser::open(&path) {
                    Ok(mut parser) => match parser.read_all_events() {
                        Ok(file_events) => {
                            events.extend(file_events);
                        }
                        Err(e) => warn!("Failed to read events from {:?}: {}", path, e),
                    },
                    Err(e) => warn!("Failed to open event file {:?}: {}", path, e),
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
