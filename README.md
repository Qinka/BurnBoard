# 🔥 BurnBoard

A TensorBoard-compatible visualization dashboard built with Rust and React.

## Features

- **Rust Client Library** (`burnboard-client`)
  - Parse TensorBoard event files (`.tfevents`)
  - High-level APIs for logging scalars, histograms, and images
  - Comprehensive error handling
  - Compatible with TensorBoard's protobuf format

- **Axum-based Server** (`burnboard-server`)
  - RESTful APIs for exposing parsed data
  - Endpoints: `/api/scalars`, `/api/histograms`
  - Static file serving for the web frontend
  - Efficient event loading from log directories

- **React Frontend**
  - Interactive data visualization using Recharts
  - Scalar value line charts
  - Histogram statistics bar charts
  - Tag selection and filtering
  - Modern, responsive UI

## Project Structure

```
BurnBoard/
├── crates/
│   ├── burnboard-client/     # Rust client library
│   │   ├── src/
│   │   │   ├── lib.rs         # Public API
│   │   │   ├── parser.rs      # Event file parser
│   │   │   ├── writer.rs      # Event writer
│   │   │   ├── error.rs       # Error types
│   │   │   └── proto/         # Protobuf definitions
│   │   ├── proto/
│   │   │   └── event.proto    # TensorBoard event format
│   │   ├── examples/          # Example usage
│   │   └── Cargo.toml
│   └── burnboard-server/      # Axum server
│       ├── src/bin/
│       │   └── server.rs      # Server binary
│       └── Cargo.toml
├── web/                       # React frontend
│   ├── src/
│   │   ├── App.jsx            # Main app component
│   │   ├── components/        # UI components
│   │   │   ├── ScalarChart.jsx
│   │   │   └── HistogramChart.jsx
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
├── assets/web/                # Built frontend (generated)
└── logs/                      # Event log files

```

## Getting Started

### Prerequisites

- Rust (latest stable)
- Node.js and npm
- protobuf-compiler (`protoc`)

On Debian/Ubuntu:
```bash
sudo apt-get install protobuf-compiler
```

### Building

1. Build the Rust client library and server:
```bash
cargo build --release
```

2. Build the React frontend:
```bash
cd web
npm install
npm run build
```

### Running

1. Generate some sample event data:
```bash
cargo run --example write_sample_data -p burnboard-client
```

2. Start the server:
```bash
cargo run --release -p burnboard-server --bin burnboard-server
```

3. Open your browser to `http://localhost:3000`

## Usage

### Writing Events (Client Library)

```rust
use burnboard_client::{EventWriter, Result};

fn main() -> Result<()> {
    let mut writer = EventWriter::create("./logs/events.tfevents")?;
    
    // Log scalar values
    writer.set_step(0);
    writer.add_scalar("train/loss", 0.5)?;
    writer.add_scalar("train/accuracy", 0.95)?;
    
    // Log histograms
    let weights = vec![0.1, 0.2, 0.15, 0.25, 0.3];
    writer.add_histogram("model/weights", &weights)?;
    
    Ok(())
}
```

### API Endpoints

- `GET /health` - Health check
- `GET /api/scalars` - Retrieve all scalar data
- `GET /api/histograms` - Retrieve all histogram data
- `GET /` - Serve the web frontend

## Development

### Running Tests

```bash
# Test client library
cargo test -p burnboard-client

# Test server
cargo test -p burnboard-server
```

### Development Mode (Frontend)

```bash
cd web
npm run dev
```

The Vite dev server will proxy API requests to `http://localhost:3000`.

## Screenshots

### Scalar Visualization
![Scalar Chart](https://github.com/user-attachments/assets/db08f021-fdb6-439b-87d6-552d3489c44c)

### Histogram Visualization
![Histogram Chart](https://github.com/user-attachments/assets/76b84ea9-d4b3-429f-a180-401aa28bf680)

## License

MIT
