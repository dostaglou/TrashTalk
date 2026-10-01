//! Pure notification planning. This module deliberately has no Tauri or Android dependency.

use crate::domain::{collections_for_date, AppState, NotificationSettings};
use chrono::{Days, NaiveDate, NaiveDateTime};
use serde::Serialize;

pub const NOTIFICATION_HORIZON_DAYS: u32 = 30;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReminderType {
    DayBefore,
    DayOf,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedNotification {
    /// Negative IDs are reserved for TrashTalk notifications when registering with Android.
    pub id: i32,
    pub collection_date: NaiveDate,
    pub reminder_type: ReminderType,
    pub scheduled_at: NaiveDateTime,
    pub title: String,
    pub body: String,
}

/// Builds all future local reminders in the supplied horizon. `now` is an explicit input so
/// tests and recurrence planning never rely on the system clock.
pub fn plan_notifications(
    state: &AppState,
    settings: &NotificationSettings,
    now: NaiveDateTime,
    horizon_days: u32,
) -> Vec<PlannedNotification> {
    let mut planned = Vec::new();

    for offset in 0..horizon_days {
        let Some(collection_date) = now.date().checked_add_days(Days::new(offset as u64)) else {
            break;
        };
        let collections = collections_for_date(state, collection_date);
        if collections.is_empty() {
            continue;
        }
        let body = join_collection_names(
            collections
                .iter()
                .map(|collection| collection.name.as_str())
                .collect(),
        );

        if settings.day_before.enabled {
            let Some(reminder_date) = collection_date.pred_opt() else {
                continue;
            };
            push_if_future(
                &mut planned,
                collection_date,
                ReminderType::DayBefore,
                reminder_date.and_time(settings.day_before.time.as_naive_time()),
                "Trash tomorrow",
                &body,
                now,
            );
        }
        if settings.day_of.enabled {
            push_if_future(
                &mut planned,
                collection_date,
                ReminderType::DayOf,
                collection_date.and_time(settings.day_of.time.as_naive_time()),
                "Trash collection today",
                &body,
                now,
            );
        }
    }

    planned.sort_by_key(|notification| (notification.scheduled_at, notification.id));
    planned
}

fn push_if_future(
    planned: &mut Vec<PlannedNotification>,
    collection_date: NaiveDate,
    reminder_type: ReminderType,
    scheduled_at: NaiveDateTime,
    title: &str,
    body: &str,
    now: NaiveDateTime,
) {
    if scheduled_at <= now {
        return;
    }
    planned.push(PlannedNotification {
        id: stable_notification_id(collection_date, reminder_type, scheduled_at),
        collection_date,
        reminder_type,
        scheduled_at,
        title: title.to_owned(),
        body: body.to_owned(),
    });
}

/// A fixed FNV-1a hash gives Android a deterministic signed 32-bit ID without persisting
/// generated occurrences. Negative IDs create a private namespace for this application.
fn stable_notification_id(
    collection_date: NaiveDate,
    reminder_type: ReminderType,
    scheduled_at: NaiveDateTime,
) -> i32 {
    let key = format!("trash-talk|{collection_date}|{reminder_type:?}|{scheduled_at}");
    let hash = key.bytes().fold(2_166_136_261_u32, |value, byte| {
        (value ^ u32::from(byte)).wrapping_mul(16_777_619)
    });
    -((hash & 0x7fff_ffff).max(1) as i32)
}

fn join_collection_names(names: Vec<&str>) -> String {
    match names.as_slice() {
        [] => String::new(),
        [name] => (*name).to_owned(),
        [first, second] => format!("{first} and {second}"),
        _ => format!(
            "{}, and {}",
            names[..names.len() - 1].join(", "),
            names.last().unwrap()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Schedule, ScheduleRule, Weekday};

    fn date(year: i32, month: u32, day: u32, hour: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(year, month, day)
            .unwrap()
            .and_hms_opt(hour, 0, 0)
            .unwrap()
    }

    fn weekly_state(days: Vec<Weekday>, collection_ids: Vec<&str>) -> AppState {
        let mut state = AppState::default();
        state.schedules.push(Schedule {
            id: "weekly".to_owned(),
            collection_type_ids: collection_ids.into_iter().map(str::to_owned).collect(),
            rule: ScheduleRule::Weekly { weekdays: days },
        });
        state
    }

    #[test]
    fn disabled_reminders_produce_no_notifications() {
        let state = weekly_state(vec![Weekday::Monday], vec!["system.combustible"]);
        assert!(plan_notifications(
            &state,
            &NotificationSettings::default(),
            date(2026, 9, 20, 9),
            30
        )
        .is_empty());
    }

    #[test]
    fn day_before_day_of_and_both_settings_are_planned() {
        let state = weekly_state(vec![Weekday::Monday], vec!["system.combustible"]);
        let now = date(2026, 9, 20, 5);
        let mut settings = NotificationSettings::default();
        settings.day_before.enabled = true;
        let before = plan_notifications(&state, &settings, now, 2);
        assert_eq!(before.len(), 1);
        assert_eq!(before[0].reminder_type, ReminderType::DayBefore);
        assert_eq!(before[0].scheduled_at, date(2026, 9, 20, 18));

        settings.day_before.enabled = false;
        settings.day_of.enabled = true;
        let day_of = plan_notifications(&state, &settings, now, 2);
        assert_eq!(day_of.len(), 1);
        assert_eq!(day_of[0].reminder_type, ReminderType::DayOf);
        assert_eq!(day_of[0].scheduled_at, date(2026, 9, 21, 6));

        settings.day_before.enabled = true;
        assert_eq!(plan_notifications(&state, &settings, now, 2).len(), 2);
    }

    #[test]
    fn collections_are_grouped_by_collection_day_and_empty_days_are_ignored() {
        let state = weekly_state(
            vec![Weekday::Monday],
            vec!["system.combustible", "system.plastics"],
        );
        let mut settings = NotificationSettings::default();
        settings.day_of.enabled = true;
        let plan = plan_notifications(&state, &settings, date(2026, 9, 20, 8), 9);
        assert_eq!(plan.len(), 2);
        assert_eq!(plan[0].body, "Combustible and Plastics");
        assert_eq!(plan[0].title, "Trash collection today");
    }

    #[test]
    fn day_before_crosses_month_and_year_boundaries_and_past_times_are_omitted() {
        let state = weekly_state(vec![Weekday::Sunday], vec!["system.glass"]);
        let mut settings = NotificationSettings::default();
        settings.day_before.enabled = true;
        settings.day_before.time = crate::domain::NotificationTime::from_hm(21, 0);
        let month_plan = plan_notifications(&state, &settings, date(2026, 2, 28, 8), 2);
        assert_eq!(
            month_plan[0].collection_date,
            NaiveDate::from_ymd_opt(2026, 3, 1).unwrap()
        );
        assert_eq!(month_plan[0].scheduled_at, date(2026, 2, 28, 21));

        let year_plan = plan_notifications(&state, &settings, date(2026, 12, 31, 8), 4);
        assert_eq!(
            year_plan[0].collection_date,
            NaiveDate::from_ymd_opt(2027, 1, 3).unwrap()
        );
        assert_eq!(year_plan[0].scheduled_at, date(2027, 1, 2, 21));

        settings.day_before.time = crate::domain::NotificationTime::from_hm(12, 0);
        assert!(plan_notifications(&state, &settings, date(2026, 2, 28, 13), 2).is_empty());
    }

    #[test]
    fn edits_deletions_and_setting_changes_change_the_plan() {
        let mut state = weekly_state(vec![Weekday::Monday], vec!["system.combustible"]);
        let mut settings = NotificationSettings::default();
        settings.day_of.enabled = true;
        let now = date(2026, 9, 20, 8);
        let initial = plan_notifications(&state, &settings, now, 3);
        state.schedules[0].rule = ScheduleRule::Weekly {
            weekdays: vec![Weekday::Tuesday],
        };
        let edited = plan_notifications(&state, &settings, now, 3);
        assert_ne!(initial[0].collection_date, edited[0].collection_date);
        state.schedules.clear();
        assert!(plan_notifications(&state, &settings, now, 3).is_empty());
        settings.day_of.enabled = false;
        assert!(plan_notifications(
            &weekly_state(vec![Weekday::Monday], vec!["system.combustible"]),
            &settings,
            now,
            3
        )
        .is_empty());
    }
}
