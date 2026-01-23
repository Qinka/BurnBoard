use thiserror::Error;

#[derive(Error, Debug)]
pub enum BurnBoardError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Decode error: {0}")]
    Decode(#[from] prost::DecodeError),

    #[error("Invalid CRC checksum")]
    InvalidChecksum,

    #[error("Invalid record format")]
    InvalidRecord,
}

pub type Result<T> = std::result::Result<T, BurnBoardError>;
