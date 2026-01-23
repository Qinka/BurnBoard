use crate::error::Result;
use crate::proto::{Event, HistogramProto, Summary};
use byteorder::{LittleEndian, WriteBytesExt};
use prost::Message;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

/// High-level API for writing TensorBoard events
pub struct EventWriter {
    writer: BufWriter<File>,
    step: i64,
}

impl EventWriter {
    /// Create a new event writer
    pub fn create<P: AsRef<Path>>(path: P) -> Result<Self> {
        let file = File::create(path)?;
        Ok(Self {
            writer: BufWriter::new(file),
            step: 0,
        })
    }
    
    /// Set the current step
    pub fn set_step(&mut self, step: i64) {
        self.step = step;
    }
    
    /// Get the current step
    pub fn step(&self) -> i64 {
        self.step
    }
    
    /// Write an event to the file
    fn write_event(&mut self, event: &Event) -> Result<()> {
        let data = event.encode_to_vec();
        let length = data.len() as u64;
        
        // Write length
        self.writer.write_u64::<LittleEndian>(length)?;
        
        // Write length CRC (simplified - use 0 for now)
        self.writer.write_u32::<LittleEndian>(0)?;
        
        // Write data
        self.writer.write_all(&data)?;
        
        // Write data CRC (simplified - use 0 for now)
        self.writer.write_u32::<LittleEndian>(0)?;
        
        self.writer.flush()?;
        Ok(())
    }
    
    /// Log a scalar value
    pub fn add_scalar(&mut self, tag: &str, value: f32) -> Result<()> {
        let wall_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
        
        let summary_value = Summary {
            value: vec![crate::proto::summary::Value {
                tag: tag.to_string(),
                value: Some(crate::proto::summary::value::Value::SimpleValue(value)),
            }],
        };
        
        let event = Event {
            wall_time,
            step: self.step,
            what: Some(crate::proto::event::What::Summary(summary_value)),
        };
        
        self.write_event(&event)
    }
    
    /// Log a histogram
    pub fn add_histogram(&mut self, tag: &str, values: &[f64]) -> Result<()> {
        let wall_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
        
        // Compute histogram statistics
        let min = values.iter().copied().fold(f64::INFINITY, f64::min);
        let max = values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let sum: f64 = values.iter().sum();
        let sum_squares: f64 = values.iter().map(|v| v * v).sum();
        let num = values.len() as f64;
        
        // Create simple histogram buckets
        let bucket_count = 30;
        let mut bucket_limits = Vec::new();
        let mut buckets = vec![0.0; bucket_count];
        
        if max > min {
            let bucket_width = (max - min) / bucket_count as f64;
            for i in 0..bucket_count {
                bucket_limits.push(min + (i + 1) as f64 * bucket_width);
            }
            
            for &value in values {
                let bucket_idx = ((value - min) / bucket_width).floor() as usize;
                let bucket_idx = bucket_idx.min(bucket_count - 1);
                buckets[bucket_idx] += 1.0;
            }
        }
        
        let histogram = HistogramProto {
            min,
            max,
            num,
            sum,
            sum_squares,
            bucket_limit: bucket_limits,
            bucket: buckets,
        };
        
        let summary_value = Summary {
            value: vec![crate::proto::summary::Value {
                tag: tag.to_string(),
                value: Some(crate::proto::summary::value::Value::Histo(histogram)),
            }],
        };
        
        let event = Event {
            wall_time,
            step: self.step,
            what: Some(crate::proto::event::What::Summary(summary_value)),
        };
        
        self.write_event(&event)
    }
    
    /// Log an image
    pub fn add_image(&mut self, tag: &str, height: i32, width: i32, encoded_image: Vec<u8>) -> Result<()> {
        let wall_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
        
        let image = crate::proto::summary::Image {
            height,
            width,
            colorspace: 3, // RGB
            encoded_image_string: encoded_image,
        };
        
        let summary_value = Summary {
            value: vec![crate::proto::summary::Value {
                tag: tag.to_string(),
                value: Some(crate::proto::summary::value::Value::Image(image)),
            }],
        };
        
        let event = Event {
            wall_time,
            step: self.step,
            what: Some(crate::proto::event::What::Summary(summary_value)),
        };
        
        self.write_event(&event)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    
    #[test]
    fn test_scalar_logging() -> Result<()> {
        let temp_file = "/tmp/test_events.tfevents";
        let mut writer = EventWriter::create(temp_file)?;
        writer.add_scalar("test/loss", 0.5)?;
        writer.add_scalar("test/accuracy", 0.95)?;
        fs::remove_file(temp_file).ok();
        Ok(())
    }
    
    #[test]
    fn test_histogram_logging() -> Result<()> {
        let temp_file = "/tmp/test_histogram.tfevents";
        let mut writer = EventWriter::create(temp_file)?;
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        writer.add_histogram("test/weights", &values)?;
        fs::remove_file(temp_file).ok();
        Ok(())
    }
}
