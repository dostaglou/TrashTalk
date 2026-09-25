use crate::domain::AppState;
use std::fmt;
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub enum StoreError {
    Io(io::Error),
    Serialization(serde_json::Error),
}

impl fmt::Display for StoreError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "state storage error: {error}"),
            Self::Serialization(error) => write!(formatter, "invalid application state: {error}"),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<io::Error> for StoreError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<serde_json::Error> for StoreError {
    fn from(error: serde_json::Error) -> Self {
        Self::Serialization(error)
    }
}

/// Persistence boundary for application state. Domain code has no knowledge of files or JSON.
pub trait StateRepository: Send + Sync + 'static {
    fn load(&self) -> Result<AppState, StoreError>;
    fn save(&self, state: &AppState) -> Result<(), StoreError>;

    fn load_or_initialize(&self) -> Result<AppState, StoreError> {
        let mut state = self.load()?;
        state.migrate_to_current();
        state.ensure_system_collection_types();
        self.save(&state)?;
        Ok(state)
    }
}

#[derive(Clone, Debug)]
pub struct JsonStateStore {
    path: PathBuf,
}

impl JsonStateStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    fn temporary_path(&self) -> PathBuf {
        let file_name = self
            .path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("state.json");
        self.path.with_file_name(format!("{file_name}.tmp"))
    }

    #[cfg(test)]
    fn path(&self) -> &Path {
        &self.path
    }
}

impl StateRepository for JsonStateStore {
    fn load(&self) -> Result<AppState, StoreError> {
        match fs::read_to_string(&self.path) {
            Ok(contents) => Ok(serde_json::from_str(&contents)?),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(AppState::default()),
            Err(error) => Err(error.into()),
        }
    }

    fn save(&self, state: &AppState) -> Result<(), StoreError> {
        let parent = self.path.parent().unwrap_or_else(|| Path::new("."));
        fs::create_dir_all(parent)?;

        let serialized = serde_json::to_vec_pretty(state)?;
        let temporary_path = self.temporary_path();
        let mut temporary_file = File::create(&temporary_path)?;
        temporary_file.write_all(&serialized)?;
        temporary_file.write_all(b"\n")?;
        temporary_file.sync_all()?;
        drop(temporary_file);

        fs::rename(&temporary_path, &self.path)?;
        // A best-effort directory sync makes the rename durable where supported.
        let _ = File::open(parent).and_then(|directory| directory.sync_all());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{CollectionType, Schedule, ScheduleRule, Weekday};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_store() -> JsonStateStore {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("trash-talk-state-{nonce}"));
        JsonStateStore::new(directory.join("state.json"))
    }

    #[test]
    fn loading_a_missing_file_returns_valid_default_state() {
        let store = test_store();
        let state = store.load().unwrap();

        assert_eq!(state.collection_types.len(), 8);
        assert!(state.schedules.is_empty());
    }

    #[test]
    fn persisted_state_round_trips_without_losing_data() {
        let store = test_store();
        let mut state = AppState::default();
        state.collection_types.push(CollectionType {
            id: "custom.garden-waste".to_owned(),
            name: "Garden waste".to_owned(),
            is_system: false,
        });
        state.schedules.push(Schedule {
            id: "schedule-1".to_owned(),
            collection_type_ids: vec!["custom.garden-waste".to_owned()],
            rule: ScheduleRule::Weekly {
                weekdays: vec![Weekday::Friday],
            },
        });

        store.save(&state).unwrap();
        assert_eq!(store.load().unwrap(), state);
        assert!(store.path().exists());
    }

    #[test]
    fn initialization_of_existing_state_does_not_duplicate_defaults() {
        let store = test_store();
        store.save(&AppState::default()).unwrap();

        let state = store.load_or_initialize().unwrap();
        assert_eq!(state.collection_types.len(), 8);
        assert_eq!(
            state
                .collection_types
                .iter()
                .filter(|item| item.is_system)
                .count(),
            8
        );
    }

    #[test]
    fn version_one_state_migrates_to_disabled_notification_settings() {
        let store = test_store();
        let old_state = r#"{
          "version": 1,
          "collectionTypes": [{"id":"system.combustible","name":"Combustible","isSystem":true}],
          "schedules": []
        }"#;
        fs::create_dir_all(store.path().parent().unwrap()).unwrap();
        fs::write(store.path(), old_state).unwrap();

        let state = store.load_or_initialize().unwrap();
        assert_eq!(state.version, crate::domain::CURRENT_STATE_VERSION);
        assert!(!state.notification_settings.day_before.enabled);
        assert!(!state.notification_settings.day_of.enabled);
        assert_eq!(state.collection_types.len(), 8);
    }
}
