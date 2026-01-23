use burnboard::{EventWriter, Result};

fn main() -> Result<()> {
    let mut writer = EventWriter::create("./logs/sample_events.tfevents")?;
    
    // Write some sample scalar data
    for step in 0..10 {
        writer.set_step(step);
        
        // Training loss (decreasing)
        let loss = 2.0 / (step as f32 + 1.0);
        writer.add_scalar("train/loss", loss)?;
        
        // Accuracy (increasing)
        let accuracy = 1.0 - 1.0 / (step as f32 + 2.0);
        writer.add_scalar("train/accuracy", accuracy)?;
        
        // Learning rate (constant then decay)
        let lr = if step < 5 { 0.001 } else { 0.0001 };
        writer.add_scalar("train/learning_rate", lr)?;
    }
    
    // Write some histogram data
    writer.set_step(10);
    let weights = vec![0.1, 0.2, 0.15, 0.25, 0.3, 0.18, 0.22, 0.12];
    writer.add_histogram("model/weights", &weights)?;
    
    println!("Sample events written to ./logs/sample_events.tfevents");
    Ok(())
}
