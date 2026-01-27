# 🔥 BurnBoard

A TensorBoard-compatible visualization dashboard built with Rust and React.

## Features

- **Unified Rust Library** (`burnboard`)
  - Parse TensorBoard event files (`.tfevents`)
  - High-level APIs for logging scalars, histograms, and images
  - Comprehensive error handling
  - Compatible with TensorBoard's protobuf format
  - Includes server binary for visualization

- **Axum-based Server**
  - RESTful APIs for exposing parsed data
  - Endpoints: `/api/scalars`, `/api/histograms`, `/api/images`
  - Static file serving for the web frontend
  - Efficient event loading from log directories

- **React Frontend**
  - Interactive data visualization using Recharts
  - Scalar value line charts
  - Histogram statistics bar charts
  - Image gallery with step-based navigation
  - Tag selection and filtering
  - Modern, responsive UI

## Project Structure

```
BurnBoard/
├── burnboard/                  # Unified Rust crate
│   ├── src/
│   │   ├── lib.rs              # Public API
│   │   ├── parser.rs           # Event file parser
│   │   ├── writer.rs           # Event writer
│   │   ├── error.rs            # Error types
│   │   ├── proto/              # Protobuf definitions
│   │   └── bin/
│   │       └── server.rs       # Server binary
│   ├── proto/
│   │   └── event.proto         # TensorBoard event format
│   ├── examples/               # Example usage
│   └── Cargo.toml
├── web/                        # React frontend
│   ├── src/
│   │   ├── App.jsx             # Main app component
│   │   ├── components/         # UI components
│   │   │   ├── ScalarChart.jsx
│   │   │   ├── HistogramChart.jsx
│   │   │   └── ImageGallery.tsx
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
cargo run --example write_sample_data
```

2. Start the server:
```bash
cargo run --release --bin burnboard-server
```

3. Open your browser to `http://localhost:3000`

## Usage

### Writing Events (Library)

```rust
use burnboard::{EventWriter, Result};

fn main() -> Result<()> {
    let mut writer = EventWriter::new("./logs")?;
    
    // Log scalar values
    writer.add_scalar("train/loss", 0.5, 0)?;
    writer.add_scalar("train/accuracy", 0.95, 0)?;
    
    // Log histograms
    let weights = vec![0.1, 0.2, 0.15, 0.25, 0.3];
    writer.add_histogram("model/weights", &weights, 0)?;
    
    // Log images (PNG-encoded bytes)
    let png_data: Vec<u8> = load_image(); // Your image loading code
    writer.add_image("visualization/sample", 64, 64, png_data, 0)?;
    
    Ok(())
}
```

### API Endpoints

- `GET /health` - Health check
- `GET /api/scalars` - Retrieve all scalar data
- `GET /api/histograms` - Retrieve all histogram data
- `GET /api/images` - Retrieve all image data (base64 encoded)
- `GET /` - Serve the web frontend

## Development

### Running Tests

```bash
# Test the library
cargo test
```

### Development Mode (Frontend)

```bash
cd web
npm run dev
```

The Vite dev server will proxy API requests to `http://localhost:3000`.

## Troubleshooting

### Vite build error: "failed to resolve import react-is"

If you encounter an error about `react-is` not being resolved, make sure to run:

```bash
cd web
rm -rf node_modules package-lock.json
npm install
```

This will clean and reinstall all dependencies including `react-is` which is required by `recharts`.

## Screenshots

### Scalar Visualization
![Scalar Chart](https://github.com/user-attachments/assets/db08f021-fdb6-439b-87d6-552d3489c44c)

### Histogram Visualization
![Histogram Chart](https://github.com/user-attachments/assets/76b84ea9-d4b3-429f-a180-401aa28bf680)

### Image Visualization
![Image Gallery](https://github.com/user-attachments/assets/a3b51150-eda0-4779-8996-f61f020bea8a)

## License

MIT
