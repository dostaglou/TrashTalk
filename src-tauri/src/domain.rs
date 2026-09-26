use chrono::{Datelike, NaiveDate, Weekday as ChronoWeekday};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const CURRENT_STATE_VERSION: u32 = 2;

pub type CollectionTypeId = String;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionType {
    pub id: CollectionTypeId,
    pub name: String,
    pub is_system: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Weekday {
    Monday,
    Tuesday,
    Wednesday,
    Thursday,
    Friday,
    Saturday,
    Sunday,
}

impl Weekday {
    pub fn label(self) -> &'static str {
        match self {
            Self::Monday => "Monday",
            Self::Tuesday => "Tuesday",
            Self::Wednesday => "Wednesday",
            Self::Thursday => "Thursday",
            Self::Friday => "Friday",
            Self::Saturday => "Saturday",
            Self::Sunday => "Sunday",
        }
    }

    fn matches(self, date: NaiveDate) -> bool {
        matches!(
            (self, date.weekday()),
            (Weekday::Monday, ChronoWeekday::Mon)
                | (Weekday::Tuesday, ChronoWeekday::Tue)
                | (Weekday::Wednesday, ChronoWeekday::Wed)
                | (Weekday::Thursday, ChronoWeekday::Thu)
                | (Weekday::Friday, ChronoWeekday::Fri)
                | (Weekday::Saturday, ChronoWeekday::Sat)
                | (Weekday::Sunday, ChronoWeekday::Sun)
        )
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScheduleRule {
    Weekly { weekdays: Vec<Weekday> },
    MonthlyNthWeekday { weekday: Weekday, ordinals: Vec<u8> },
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: String,
    pub collection_type_ids: Vec<CollectionTypeId>,
    pub rule: ScheduleRule,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleInput {
    pub collection_type_ids: Vec<CollectionTypeId>,
    pub rule: ScheduleRule,
}

/// The three deliberately broad delivery periods offered by the product.
/// They are nominal local times, not exact-alarm guarantees.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationTime {
    Early,
    #[serde(alias = "afternoon")]
    Middle,
    Late,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderSetting {
    pub enabled: bool,
    pub time: NotificationTime,
}

impl Default for ReminderSetting {
    fn default() -> Self {
        Self {
            enabled: false,
            time: NotificationTime::Early,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub day_before: ReminderSetting,
    pub day_of: ReminderSetting,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub version: u32,
    pub collection_types: Vec<CollectionType>,
    pub schedules: Vec<Schedule>,
    #[serde(default)]
    pub notification_settings: NotificationSettings,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            version: CURRENT_STATE_VERSION,
            collection_types: default_collection_types(),
            schedules: Vec::new(),
            notification_settings: NotificationSettings::default(),
        }
    }
}

impl AppState {
    /// Moves known persisted state versions forward without changing user schedules.
    /// The missing `notification_settings` field in version 1 deserializes to disabled defaults.
    pub fn migrate_to_current(&mut self) -> bool {
        if self.version < CURRENT_STATE_VERSION {
            self.version = CURRENT_STATE_VERSION;
            return true;
        }
        false
    }

    /// Adds newly introduced system types without touching custom types or schedules.
    /// Returns whether the persisted state changed.
    pub fn ensure_system_collection_types(&mut self) -> bool {
        let existing_ids: HashSet<&str> = self
            .collection_types
            .iter()
            .map(|collection_type| collection_type.id.as_str())
            .collect();
        let missing: Vec<CollectionType> = default_collection_types()
            .into_iter()
            .filter(|collection_type| !existing_ids.contains(collection_type.id.as_str()))
            .collect();

        let changed = !missing.is_empty();
        self.collection_types.extend(missing);
        changed
    }
}

pub fn default_collection_types() -> Vec<CollectionType> {
    [
        ("system.combustible", "Combustible"),
        ("system.plastics", "Plastics"),
        ("system.pet-bottles", "PET Bottles"),
        ("system.unburnables", "Unburnables"),
        ("system.glass", "Glass"),
        ("system.cans-and-spray-cans", "Cans & Spray cans"),
        (
            "system.cardboard-newspapers-magazines",
            "Cardboard, Newspapers & Magazines",
        ),
        (
            "system.small-electronics-household-appliances",
            "Small Electronics & Household Appliances",
        ),
    ]
    .into_iter()
    .map(|(id, name)| CollectionType {
        id: id.to_owned(),
        name: name.to_owned(),
        is_system: true,
    })
    .collect()
}

pub fn collections_for_date(state: &AppState, date: NaiveDate) -> Vec<CollectionType> {
    let scheduled_type_ids: HashSet<&str> = state
        .schedules
        .iter()
        .filter(|schedule| schedule_matches(schedule, date))
        .flat_map(|schedule| schedule.collection_type_ids.iter().map(String::as_str))
        .collect();

    state
        .collection_types
        .iter()
        .filter(|collection_type| scheduled_type_ids.contains(collection_type.id.as_str()))
        .cloned()
        .collect()
}

pub fn schedule_matches(schedule: &Schedule, date: NaiveDate) -> bool {
    match &schedule.rule {
        ScheduleRule::Weekly { weekdays } => weekdays.iter().any(|weekday| weekday.matches(date)),
        ScheduleRule::MonthlyNthWeekday { weekday, ordinals } => {
            weekday.matches(date) && ordinals.contains(&ordinal_in_month(date))
        }
    }
}

pub fn ordinal_in_month(date: NaiveDate) -> u8 {
    ((date.day() - 1) / 7 + 1) as u8
}

pub fn recurrence_description(rule: &ScheduleRule) -> String {
    match rule {
        ScheduleRule::Weekly { weekdays } => format!(
            "Every {}",
            join_words(weekdays.iter().map(|weekday| weekday.label()).collect())
        ),
        ScheduleRule::MonthlyNthWeekday { weekday, ordinals } => format!(
            "{} {} of each month",
            join_words(
                ordinals
                    .iter()
                    .map(|ordinal| ordinal_label(*ordinal))
                    .collect()
            ),
            weekday.label()
        ),
    }
}

fn ordinal_label(ordinal: u8) -> &'static str {
    match ordinal {
        1 => "1st",
        2 => "2nd",
        3 => "3rd",
        4 => "4th",
        5 => "5th",
        _ => "invalid ordinal",
    }
}

fn join_words(words: Vec<&str>) -> String {
    match words.as_slice() {
        [] => String::new(),
        [word] => (*word).to_owned(),
        [first, second] => format!("{first} and {second}"),
        _ => format!(
            "{}, and {}",
            words[..words.len() - 1].join(", "),
            words.last().unwrap()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_state_has_the_eight_expected_system_types_with_unique_stable_ids() {
        let state = AppState::default();
        let names: Vec<&str> = state
            .collection_types
            .iter()
            .map(|collection_type| collection_type.name.as_str())
            .collect();
        let ids: HashSet<&str> = state
            .collection_types
            .iter()
            .map(|collection_type| collection_type.id.as_str())
            .collect();

        assert_eq!(state.collection_types.len(), 8);
        assert_eq!(ids.len(), 8);
        assert_eq!(
            names,
            vec![
                "Combustible",
                "Plastics",
                "PET Bottles",
                "Unburnables",
                "Glass",
                "Cans & Spray cans",
                "Cardboard, Newspapers & Magazines",
                "Small Electronics & Household Appliances",
            ]
        );
        assert!(state.collection_types.iter().all(|item| item.is_system));
        assert!(state.schedules.is_empty());
    }

    #[test]
    fn no_schedules_means_no_collections_for_any_date() {
        let state = AppState::default();
        let date = NaiveDate::from_ymd_opt(2026, 9, 25).unwrap();

        assert!(collections_for_date(&state, date).is_empty());
    }

    #[test]
    fn typed_rules_match_weekly_and_monthly_nth_weekday_schedules() {
        let schedule = Schedule {
            id: "schedule-1".to_owned(),
            collection_type_ids: vec!["system.combustible".to_owned()],
            rule: ScheduleRule::MonthlyNthWeekday {
                weekday: Weekday::Wednesday,
                ordinals: vec![2, 4],
            },
        };

        assert!(schedule_matches(
            &schedule,
            NaiveDate::from_ymd_opt(2026, 9, 9).unwrap()
        ));
        assert!(!schedule_matches(
            &schedule,
            NaiveDate::from_ymd_opt(2026, 9, 16).unwrap()
        ));
    }

    #[test]
    fn weekly_and_multiple_schedules_match_the_same_date() {
        let mut state = AppState::default();
        state.schedules = vec![
            Schedule {
                id: "monday-combustible".to_owned(),
                collection_type_ids: vec!["system.combustible".to_owned()],
                rule: ScheduleRule::Weekly {
                    weekdays: vec![Weekday::Monday],
                },
            },
            Schedule {
                id: "monday-plastics".to_owned(),
                collection_type_ids: vec!["system.plastics".to_owned()],
                rule: ScheduleRule::Weekly {
                    weekdays: vec![Weekday::Monday, Weekday::Thursday],
                },
            },
        ];

        let collections =
            collections_for_date(&state, NaiveDate::from_ymd_opt(2026, 9, 21).unwrap());
        assert_eq!(
            collections
                .iter()
                .map(|collection| collection.name.as_str())
                .collect::<Vec<_>>(),
            vec!["Combustible", "Plastics"]
        );
    }

    #[test]
    fn fifth_weekday_only_matches_in_months_that_have_one() {
        let schedule = Schedule {
            id: "fifth-monday".to_owned(),
            collection_type_ids: vec!["system.glass".to_owned()],
            rule: ScheduleRule::MonthlyNthWeekday {
                weekday: Weekday::Monday,
                ordinals: vec![5],
            },
        };

        assert!(schedule_matches(
            &schedule,
            NaiveDate::from_ymd_opt(2026, 3, 30).unwrap()
        ));
        assert!(!schedule_matches(
            &schedule,
            NaiveDate::from_ymd_opt(2026, 2, 23).unwrap()
        ));
    }

    #[test]
    fn seeding_an_existing_state_does_not_duplicate_system_types() {
        let mut state = AppState::default();

        assert!(!state.ensure_system_collection_types());
        assert_eq!(state.collection_types.len(), 8);
    }

    #[test]
    fn notification_settings_round_trip_through_json() {
        let mut state = AppState::default();
        state.notification_settings = NotificationSettings {
            day_before: ReminderSetting {
                enabled: true,
                time: NotificationTime::Late,
            },
            day_of: ReminderSetting {
                enabled: true,
                time: NotificationTime::Middle,
            },
        };

        let serialized = serde_json::to_string(&state).unwrap();
        assert_eq!(
            serde_json::from_str::<AppState>(&serialized).unwrap(),
            state
        );
    }
}
