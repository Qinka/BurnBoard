use burnboard::{EventWriter, Result};

/// Creates a simple RGB gradient pattern as PNG bytes.
/// This is a minimal PNG encoder to avoid external dependencies.
fn create_gradient_png(width: u32, height: u32, step: i64) -> Vec<u8> {
    // Create raw RGBA pixel data (4 bytes per pixel: R, G, B, A)
    let mut pixels = Vec::with_capacity((width * height * 4) as usize);
    
    // Create a gradient that changes with step
    let step_offset = (step as f64 * 0.1) % 1.0;
    
    for y in 0..height {
        for x in 0..width {
            let r = ((x as f64 / width as f64 * 255.0) + step_offset * 128.0) as u8;
            let g = ((y as f64 / height as f64 * 255.0) + step_offset * 64.0) as u8;
            let b = (((x + y) as f64 / (width + height) as f64 * 255.0) + step_offset * 192.0) as u8;
            let a = 255u8; // Full opacity
            pixels.extend_from_slice(&[r, g, b, a]);
        }
    }
    
    // Encode as PNG using minimal implementation
    encode_png(width, height, &pixels)
}

/// Minimal PNG encoder - creates a valid PNG from RGBA data
fn encode_png(width: u32, height: u32, rgba_data: &[u8]) -> Vec<u8> {
    let mut png = Vec::new();
    
    // PNG signature
    png.extend_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
    
    // IHDR chunk
    let ihdr_data = [
        (width >> 24) as u8, (width >> 16) as u8, (width >> 8) as u8, width as u8,
        (height >> 24) as u8, (height >> 16) as u8, (height >> 8) as u8, height as u8,
        8,  // bit depth
        6,  // color type (RGBA)
        0,  // compression method
        0,  // filter method
        0,  // interlace method
    ];
    write_chunk(&mut png, b"IHDR", &ihdr_data);
    
    // IDAT chunk (raw pixel data with zlib header)
    let mut raw_data = Vec::new();
    
    // Minimal zlib header (no compression)
    raw_data.push(0x78); // CMF
    raw_data.push(0x01); // FLG
    
    // Process image data row by row
    let row_bytes = width as usize * 4;
    let mut uncompressed = Vec::new();
    
    for y in 0..height as usize {
        uncompressed.push(0); // Filter type: None
        let row_start = y * row_bytes;
        let row_end = row_start + row_bytes;
        uncompressed.extend_from_slice(&rgba_data[row_start..row_end]);
    }
    
    // Write deflate blocks (uncompressed for simplicity)
    let chunks: Vec<&[u8]> = uncompressed.chunks(65535).collect();
    for (i, chunk) in chunks.iter().enumerate() {
        let is_final = i == chunks.len() - 1;
        raw_data.push(if is_final { 0x01 } else { 0x00 }); // BFINAL + BTYPE
        let len = chunk.len() as u16;
        let nlen = !len;
        raw_data.push(len as u8);
        raw_data.push((len >> 8) as u8);
        raw_data.push(nlen as u8);
        raw_data.push((nlen >> 8) as u8);
        raw_data.extend_from_slice(chunk);
    }
    
    // Adler-32 checksum
    let mut s1: u32 = 1;
    let mut s2: u32 = 0;
    for byte in &uncompressed {
        s1 = (s1 + *byte as u32) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    let adler32 = (s2 << 16) | s1;
    raw_data.push((adler32 >> 24) as u8);
    raw_data.push((adler32 >> 16) as u8);
    raw_data.push((adler32 >> 8) as u8);
    raw_data.push(adler32 as u8);
    
    write_chunk(&mut png, b"IDAT", &raw_data);
    
    // IEND chunk
    write_chunk(&mut png, b"IEND", &[]);
    
    png
}

/// Write a PNG chunk with CRC
fn write_chunk(png: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    let len = data.len() as u32;
    png.push((len >> 24) as u8);
    png.push((len >> 16) as u8);
    png.push((len >> 8) as u8);
    png.push(len as u8);
    png.extend_from_slice(chunk_type);
    png.extend_from_slice(data);
    
    // Calculate CRC32 (IEEE polynomial)
    let crc = crc32(&[chunk_type.as_slice(), data].concat());
    png.push((crc >> 24) as u8);
    png.push((crc >> 16) as u8);
    png.push((crc >> 8) as u8);
    png.push(crc as u8);
}

/// Simple CRC32 calculation (IEEE polynomial)
fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFFFFFFu32;
    for byte in data {
        crc ^= *byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB88320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

fn main() -> Result<()> {
    // Create log directory if it doesn't exist
    std::fs::create_dir_all("./logs/image_run")?;
    
    let mut writer = EventWriter::new("./logs/image_run")?;

    // Write scalar data alongside images
    for step in 0..5 {
        // Training loss (decreasing)
        let loss = 2.0 / (step as f32 + 1.0);
        writer.add_scalar("train/loss", loss, step)?;

        // Accuracy (increasing)
        let accuracy = 1.0 - 1.0 / (step as f32 + 2.0);
        writer.add_scalar("train/accuracy", accuracy, step)?;
    }

    // Write sample images at different steps
    println!("Generating sample images...");
    
    for step in [0, 2, 4, 6, 8].iter() {
        // Create gradient images that change with step
        let width = 64;
        let height = 64;
        
        let png_data = create_gradient_png(width, height, *step);
        
        writer.add_image(
            "visualization/gradient",
            height as i32,
            width as i32,
            png_data.clone(),
            *step,
        )?;
        
        // Also create a different image tag
        let png_data2 = create_gradient_png(32, 32, *step + 10);
        writer.add_image(
            "visualization/small_pattern",
            32,
            32,
            png_data2,
            *step,
        )?;
        
        println!("  Step {}: Generated images", step);
    }

    // Write histogram data
    let weights = vec![0.1, 0.2, 0.15, 0.25, 0.3, 0.18, 0.22, 0.12];
    writer.add_histogram("model/weights", &weights, 10)?;

    println!("\nSample data with images written to ./logs/image_run/");
    println!("Run the server to visualize: cargo run --release --features command-line --bin server -- --log-dir ./logs");
    Ok(())
}
