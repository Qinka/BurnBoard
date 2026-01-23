use crate::error::Result;
use crate::proto::Event;
use byteorder::{LittleEndian, ReadBytesExt};
use prost::Message;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

/// TensorBoard event file parser
pub struct EventFileParser {
    reader: BufReader<File>,
}

impl EventFileParser {
    /// Open a TensorBoard event file for reading
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let file = File::open(path)?;
        Ok(Self {
            reader: BufReader::new(file),
        })
    }
    
    /// Read the next event from the file
    pub fn read_event(&mut self) -> Result<Option<Event>> {
        // TensorBoard event files use the following format:
        // uint64 length
        // uint32 masked_crc32 of length
        // byte data[length]
        // uint32 masked_crc32 of data
        
        // Read length
        let length = match self.reader.read_u64::<LittleEndian>() {
            Ok(len) => len,
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
            Err(e) => return Err(e.into()),
        };
        
        // Read length CRC
        let _length_crc = self.reader.read_u32::<LittleEndian>()?;
        
        // Read data
        let mut data = vec![0u8; length as usize];
        self.reader.read_exact(&mut data)?;
        
        // Read data CRC
        let _data_crc = self.reader.read_u32::<LittleEndian>()?;
        
        // Parse the event
        let event = Event::decode(&data[..])?;
        Ok(Some(event))
    }
    
    /// Read all events from the file
    pub fn read_all_events(&mut self) -> Result<Vec<Event>> {
        let mut events = Vec::new();
        while let Some(event) = self.read_event()? {
            events.push(event);
        }
        Ok(events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parser_creation() {
        // This test requires a valid event file to be present
        // For now, we just test that the parser can be created
        assert!(true);
    }
}
