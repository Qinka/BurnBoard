pub mod error;
pub mod parser;
pub mod proto;
pub mod writer;

// Re-export commonly used types
pub use error::{BurnBoardError, Result};
pub use parser::EventFileParser;
pub use proto::{Event, HistogramProto, Summary};
pub use writer::EventWriter;

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_basic_workflow() {
        // Test that we can create a writer and parser
        let result = EventWriter::create("/tmp/test_workflow.tfevents");
        assert!(result.is_ok());
    }
}
