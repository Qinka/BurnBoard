use burnboard::{EventWriter, Result};
use std::fs;

fn main() -> Result<()> {
    // Ensure logs directory exists
    fs::create_dir_all("./logs")?;
    
    let mut writer = EventWriter::new("./logs")?;

    // Write a large dataset with many steps to test sampling
    // This will create 5000 data points to test the backend sampling
    for step in 0..5000 {
        // Training loss (decreasing with some noise)
        let noise = (step as f32 * 0.1).sin() * 0.1;
        let loss = 2.0 / (step as f32 / 100.0 + 1.0) + noise;
        writer.add_scalar("train/loss", loss, step)?;

        // Accuracy (increasing with some noise)
        let accuracy = (1.0 - 1.0 / (step as f32 / 100.0 + 2.0)) + noise * 0.05;
        writer.add_scalar("train/accuracy", accuracy, step)?;

        // Learning rate (exponential decay)
        let lr = 0.01 * 0.995_f32.powi(step as i32);
        writer.add_scalar("train/learning_rate", lr, step)?;

        // Validation metrics (less frequent updates)
        if step % 10 == 0 {
            let val_loss = 2.2 / (step as f32 / 100.0 + 1.0) + noise * 0.5;
            writer.add_scalar("val/loss", val_loss, step)?;
            
            let val_acc = (0.95 - 0.95 / (step as f32 / 100.0 + 2.0)) + noise * 0.03;
            writer.add_scalar("val/accuracy", val_acc, step)?;
        }

        // Write histogram data every 100 steps
        if step % 100 == 0 {
            let weights: Vec<f64> = (0..100)
                .map(|i| (i as f64 / 100.0 + step as f64 / 1000.0).sin())
                .collect();
            writer.add_histogram("model/weights", &weights, step)?;
        }
    }

    println!("Large dataset written to ./logs/events.tfevents.*");
    println!("Total data points created:");
    println!("  - train/loss: 5000 points");
    println!("  - train/accuracy: 5000 points");
    println!("  - train/learning_rate: 5000 points");
    println!("  - val/loss: 500 points");
    println!("  - val/accuracy: 500 points");
    println!("  - model/weights: 50 histograms");
    Ok(())
}
