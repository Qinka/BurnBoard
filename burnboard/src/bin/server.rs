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

    // Load events from log directory if it exists
    if args.log_dir.exists() {
        info!("Loading events from {:?}", args.log_dir);
        let mut events = state.events.write().await;

        // Scan directory for .tfevents files
        if let Ok(entries) = std::fs::read_dir(&args.log_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .and_then(|s| s.split('.').find(|&s| s == "tfevents"))
                    .is_some()
                {
                    info!("Loading events from {:?}", path);
                    match EventFileParser::open(&path) {
                        Ok(mut parser) => match parser.read_all_events() {
                            Ok(file_events) => {
                                info!("Loaded {} events from {:?}", file_events.len(), path);
                                events.extend(file_events);
                            }
                            Err(e) => warn!("Failed to read events from {:?}: {}", path, e),
                        },
                        Err(e) => warn!("Failed to open event file {:?}: {}", path, e),
                    }
                }
            }
        }
        info!("Total events loaded: {}", events.len());
    }

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
