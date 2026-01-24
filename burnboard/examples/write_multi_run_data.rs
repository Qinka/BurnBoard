use burnboard::{EventWriter, Result};

fn main() -> Result<()> {
    // Create run1 data
    std::fs::create_dir_all("./logs/run1")?;
    let mut writer1 = EventWriter::new("./logs/run1")?;
    for step in 0..20 {
        let loss = 2.0 / (step as f32 + 1.0);
        let accuracy = 1.0 - 1.0 / (step as f32 + 2.0);
        writer1.add_scalar("train/loss", loss, step)?;
        writer1.add_scalar("train/accuracy", accuracy, step)?;
    }
    let weights1 = vec![0.1, 0.2, 0.15, 0.25, 0.3];
    writer1.add_histogram("model/weights", &weights1, 20)?;
    println!("Run 1 data written");

    // Create run2 data with slightly different values
    std::fs::create_dir_all("./logs/run2")?;
    let mut writer2 = EventWriter::new("./logs/run2")?;
    for step in 0..20 {
        let loss = 2.5 / (step as f32 + 1.5);
        let accuracy = 0.9 - 0.9 / (step as f32 + 2.5);
        writer2.add_scalar("train/loss", loss, step)?;
        writer2.add_scalar("train/accuracy", accuracy, step)?;
    }
    let weights2 = vec![0.15, 0.25, 0.1, 0.2, 0.28];
    writer2.add_histogram("model/weights", &weights2, 20)?;
    println!("Run 2 data written");

    // Create run3 data in nested subdirectory
    std::fs::create_dir_all("./logs/experiments/run3")?;
    let mut writer3 = EventWriter::new("./logs/experiments/run3")?;
    for step in 0..20 {
        let loss = 1.8 / (step as f32 + 0.8);
        let accuracy = 0.95 - 0.95 / (step as f32 + 3.0);
        writer3.add_scalar("train/loss", loss, step)?;
        writer3.add_scalar("train/accuracy", accuracy, step)?;
    }
    let weights3 = vec![0.12, 0.22, 0.18, 0.28, 0.32];
    writer3.add_histogram("model/weights", &weights3, 20)?;
    println!("Run 3 (nested) data written");

    println!("All sample events written to ./logs");
    Ok(())
}
