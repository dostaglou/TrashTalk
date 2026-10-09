use chrono::{Datelike, NaiveDate, NaiveTime, Timelike, Weekday as ChronoWeekday};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub type CollectionTypeId = String;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CollectionTypeKey {
    Combustible,
    Plastics,
    PetBottles,
    Unburnables,
    Glass,
    Cans,
    PaperGoods,
    Appliances,
    Custom { name: String },
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionType {
    pub id: CollectionTypeId,
    pub key: CollectionTypeKey,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Locale {
    English,
    Japanese,
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

/// A local notification time.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NotificationTime(NaiveTime);

impl NotificationTime {
    pub fn from_hm(hour: u32, minute: u32) -> Self {
        Self::try_from_hm(hour, minute).expect("notification times must be valid")
    }

    fn try_from_hm(hour: u32, minute: u32) -> Result<Self, String> {
        if hour > 23 || minute > 59 {
            return Err("notification time must be valid".to_owned());
        }
        Ok(Self(NaiveTime::from_hms_opt(hour, minute, 0).unwrap()))
    }

    pub fn as_naive_time(self) -> NaiveTime {
        self.0
    }
}

impl Default for NotificationTime {
    fn default() -> Self {
        Self::from_hm(6, 0)
    }
}

impl Serialize for NotificationTime {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0.format("%H:%M").to_string())
    }
}

impl<'de> Deserialize<'de> for NotificationTime {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        let parsed =
            NaiveTime::parse_from_str(&value, "%H:%M").map_err(serde::de::Error::custom)?;
        Self::try_from_hm(parsed.hour(), parsed.minute()).map_err(serde::de::Error::custom)
    }
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
            time: NotificationTime::default(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub day_before: ReminderSetting,
    pub day_of: ReminderSetting,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            day_before: ReminderSetting {
                enabled: false,
                time: NotificationTime::from_hm(18, 0),
            },
            day_of: ReminderSetting::default(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub collection_types: Vec<CollectionType>,
    pub schedules: Vec<Schedule>,
    pub notification_settings: NotificationSettings,
    pub locale: Option<Locale>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            collection_types: default_collection_types(),
            schedules: Vec::new(),
            notification_settings: NotificationSettings::default(),
            locale: None,
        }
    }
}

pub fn default_collection_types() -> Vec<CollectionType> {
    [
        ("system.combustible", CollectionTypeKey::Combustible),
        ("system.plastics", CollectionTypeKey::Plastics),
        ("system.pet_bottles", CollectionTypeKey::PetBottles),
        ("system.unburnables", CollectionTypeKey::Unburnables),
        ("system.glass", CollectionTypeKey::Glass),
        ("system.cans", CollectionTypeKey::Cans),
        ("system.paper_goods", CollectionTypeKey::PaperGoods),
        ("system.appliances", CollectionTypeKey::Appliances),
    ]
    .into_iter()
    .map(|(id, key)| CollectionType {
        id: id.to_owned(),
        key,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_state_has_the_eight_expected_system_types_with_unique_stable_ids() {
        let state = AppState::default();
        let keys: Vec<&CollectionTypeKey> = state
            .collection_types
            .iter()
            .map(|collection_type| &collection_type.key)
            .collect();
        let ids: HashSet<&str> = state
            .collection_types
            .iter()
            .map(|collection_type| collection_type.id.as_str())
            .collect();

        assert_eq!(state.collection_types.len(), 8);
        assert_eq!(ids.len(), 8);
        assert_eq!(
            keys,
            vec![
                &CollectionTypeKey::Combustible,
                &CollectionTypeKey::Plastics,
                &CollectionTypeKey::PetBottles,
                &CollectionTypeKey::Unburnables,
                &CollectionTypeKey::Glass,
                &CollectionTypeKey::Cans,
                &CollectionTypeKey::PaperGoods,
                &CollectionTypeKey::Appliances,
            ]
        );
        assert!(state
            .collection_types
            .iter()
            .all(|item| !matches!(item.key, CollectionTypeKey::Custom { .. })));
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
                .map(|collection| &collection.key)
                .collect::<Vec<_>>(),
            vec![
                &CollectionTypeKey::Combustible,
                &CollectionTypeKey::Plastics
            ]
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
    fn notification_settings_round_trip_through_json() {
        let mut state = AppState::default();
        state.notification_settings = NotificationSettings {
            day_before: ReminderSetting {
                enabled: true,
                time: NotificationTime::from_hm(21, 0),
            },
            day_of: ReminderSetting {
                enabled: true,
                time: NotificationTime::from_hm(18, 0),
            },
        };
        state.locale = Some(Locale::Japanese);

        let serialized = serde_json::to_string(&state).unwrap();
        assert_eq!(
            serde_json::from_str::<AppState>(&serialized).unwrap(),
            state
        );
    }
}
