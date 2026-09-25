use crate::domain::{
    collections_for_date, recurrence_description, AppState, CollectionType, Schedule,
    ScheduleInput, ScheduleRule,
};
use crate::storage::{StateRepository, StoreError};
use chrono::{Datelike, Local, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeDay {
    pub date: NaiveDate,
    pub collections: Vec<CollectionType>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeSummary {
    pub today: HomeDay,
    pub tomorrow: HomeDay,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDay {
    pub date: NaiveDate,
    pub collections: Vec<CollectionType>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CalendarPeriodKind {
    NextSevenDays,
    ThisMonth,
    NextMonth,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarPeriod {
    pub today: NaiveDate,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub days: Vec<CalendarDay>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleSummary {
    pub id: String,
    pub collection_types: Vec<CollectionType>,
    pub recurrence_description: String,
}

pub fn home_summary_for(state: &AppState, today: NaiveDate) -> HomeSummary {
    let tomorrow = today.succ_opt().expect("today must have a following date");
    HomeSummary {
        today: HomeDay {
            date: today,
            collections: collections_for_date(state, today),
        },
        tomorrow: HomeDay {
            date: tomorrow,
            collections: collections_for_date(state, tomorrow),
        },
    }
}

pub fn calendar_days_for(
    state: &AppState,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<Vec<CalendarDay>, String> {
    if end_date < start_date {
        return Err("The calendar end date must be on or after the start date.".to_owned());
    }

    let mut date = start_date;
    let mut days = Vec::new();
    loop {
        days.push(CalendarDay {
            date,
            collections: collections_for_date(state, date),
        });
        if date == end_date {
            break;
        }
        date = date
            .succ_opt()
            .ok_or_else(|| "The requested calendar range is too large.".to_owned())?;
    }
    Ok(days)
}

pub fn calendar_period_for(
    state: &AppState,
    today: NaiveDate,
    period: CalendarPeriodKind,
) -> Result<CalendarPeriod, String> {
    let (start_date, end_date) = match period {
        CalendarPeriodKind::NextSevenDays => (
            today,
            today
                .checked_add_days(chrono::Days::new(6))
                .ok_or_else(|| "The requested calendar range is too large.".to_owned())?,
        ),
        CalendarPeriodKind::ThisMonth => month_bounds(today.year(), today.month())?,
        CalendarPeriodKind::NextMonth => {
            let (year, month) = if today.month() == 12 {
                (today.year() + 1, 1)
            } else {
                (today.year(), today.month() + 1)
            };
            month_bounds(year, month)?
        }
    };
    Ok(CalendarPeriod {
        today,
        start_date,
        end_date,
        days: calendar_days_for(state, start_date, end_date)?,
    })
}

fn month_bounds(year: i32, month: u32) -> Result<(NaiveDate, NaiveDate), String> {
    let start_date = NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| "The requested calendar month is invalid.".to_owned())?;
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let end_date = NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .and_then(|date| date.pred_opt())
        .ok_or_else(|| "The requested calendar month is invalid.".to_owned())?;
    Ok((start_date, end_date))
}

/// Application layer: owns loaded state and exposes presentation-oriented operations.
pub struct AppService<R: StateRepository> {
    repository: R,
    state: Mutex<AppState>,
}

impl<R: StateRepository> AppService<R> {
    pub fn open(repository: R) -> Result<Self, StoreError> {
        let state = repository.load_or_initialize()?;
        Ok(Self {
            repository,
            state: Mutex::new(state),
        })
    }

    pub fn home_summary(&self) -> Result<HomeSummary, String> {
        self.home_summary_for_date(Local::now().date_naive())
    }

    pub fn home_summary_for_date(&self, today: NaiveDate) -> Result<HomeSummary, String> {
        let state = self.lock_state()?;
        Ok(home_summary_for(&state, today))
    }

    pub fn collection_calendar(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<CalendarDay>, String> {
        let start_date = parse_calendar_date(start_date, "start")?;
        let end_date = parse_calendar_date(end_date, "end")?;
        let state = self.lock_state()?;
        calendar_days_for(&state, start_date, end_date)
    }

    pub fn calendar_period(&self, period: CalendarPeriodKind) -> Result<CalendarPeriod, String> {
        let state = self.lock_state()?;
        calendar_period_for(&state, Local::now().date_naive(), period)
    }

    pub fn list_collection_types(&self) -> Result<Vec<CollectionType>, String> {
        Ok(self.lock_state()?.collection_types.clone())
    }

    pub fn list_schedules(&self) -> Result<Vec<ScheduleSummary>, String> {
        let state = self.lock_state()?;
        Ok(state
            .schedules
            .iter()
            .map(|schedule| schedule_summary(&state, schedule))
            .collect())
    }

    pub fn get_schedule(&self, id: &str) -> Result<Schedule, String> {
        self.lock_state()?
            .schedules
            .iter()
            .find(|schedule| schedule.id == id)
            .cloned()
            .ok_or_else(|| "Schedule not found.".to_owned())
    }

    pub fn create_schedule(&self, input: ScheduleInput) -> Result<Schedule, String> {
        self.mutate_state(move |state| {
            let normalized = normalize_schedule_input(state, input)?;
            let schedule = Schedule {
                id: Uuid::new_v4().to_string(),
                collection_type_ids: normalized.collection_type_ids,
                rule: normalized.rule,
            };
            state.schedules.push(schedule.clone());
            Ok(schedule)
        })
    }

    pub fn update_schedule(&self, id: &str, input: ScheduleInput) -> Result<Schedule, String> {
        let id = id.to_owned();
        self.mutate_state(move |state| {
            let normalized = normalize_schedule_input(state, input)?;
            let schedule = state
                .schedules
                .iter_mut()
                .find(|schedule| schedule.id == id)
                .ok_or_else(|| "Schedule not found.".to_owned())?;
            schedule.collection_type_ids = normalized.collection_type_ids;
            schedule.rule = normalized.rule;
            Ok(schedule.clone())
        })
    }

    pub fn delete_schedule(&self, id: &str) -> Result<(), String> {
        let id = id.to_owned();
        self.mutate_state(move |state| {
            let index = state
                .schedules
                .iter()
                .position(|schedule| schedule.id == id)
                .ok_or_else(|| "Schedule not found.".to_owned())?;
            state.schedules.remove(index);
            Ok(())
        })
    }

    fn lock_state(&self) -> Result<std::sync::MutexGuard<'_, AppState>, String> {
        self.state
            .lock()
            .map_err(|_| "Application state is unavailable.".to_owned())
    }

    fn mutate_state<T>(
        &self,
        mutation: impl FnOnce(&mut AppState) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut state = self.lock_state()?;
        let mut next_state = state.clone();
        let result = mutation(&mut next_state)?;
        self.repository
            .save(&next_state)
            .map_err(|error| format!("Unable to save schedule: {error}"))?;
        *state = next_state;
        Ok(result)
    }
}

fn parse_calendar_date(value: &str, boundary: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| format!("The calendar {boundary} date must use YYYY-MM-DD."))
}

fn schedule_summary(state: &AppState, schedule: &Schedule) -> ScheduleSummary {
    let selected_ids: HashSet<&str> = schedule
        .collection_type_ids
        .iter()
        .map(String::as_str)
        .collect();
    ScheduleSummary {
        id: schedule.id.clone(),
        collection_types: state
            .collection_types
            .iter()
            .filter(|collection_type| selected_ids.contains(collection_type.id.as_str()))
            .cloned()
            .collect(),
        recurrence_description: recurrence_description(&schedule.rule),
    }
}

fn normalize_schedule_input(
    state: &AppState,
    input: ScheduleInput,
) -> Result<ScheduleInput, String> {
    let collection_type_ids = unique(input.collection_type_ids);
    if collection_type_ids.is_empty() {
        return Err("Choose at least one collection type.".to_owned());
    }
    if let Some(id) = collection_type_ids.iter().find(|id| {
        !state
            .collection_types
            .iter()
            .any(|collection_type| collection_type.id == **id)
    }) {
        return Err(format!("The collection type '{id}' does not exist."));
    }

    let rule = match input.rule {
        ScheduleRule::Weekly { weekdays } => {
            let weekdays = unique(weekdays);
            if weekdays.is_empty() {
                return Err("Choose at least one weekday for a weekly schedule.".to_owned());
            }
            ScheduleRule::Weekly { weekdays }
        }
        ScheduleRule::MonthlyNthWeekday { weekday, ordinals } => {
            let ordinals = unique(ordinals);
            if ordinals.is_empty() {
                return Err("Choose at least one monthly occurrence.".to_owned());
            }
            if let Some(ordinal) = ordinals
                .iter()
                .find(|&&ordinal| ordinal == 0 || ordinal > 5)
            {
                return Err(format!(
                    "Monthly occurrence '{ordinal}' must be between 1st and 5th."
                ));
            }
            ScheduleRule::MonthlyNthWeekday { weekday, ordinals }
        }
    };

    Ok(ScheduleInput {
        collection_type_ids,
        rule,
    })
}

fn unique<T: Clone + Eq + std::hash::Hash>(items: Vec<T>) -> Vec<T> {
    let mut seen = HashSet::new();
    items
        .into_iter()
        .filter(|item| seen.insert(item.clone()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Weekday;
    use crate::storage::JsonStateStore;
    use std::sync::Arc;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[derive(Clone)]
    struct MemoryStore(Arc<Mutex<AppState>>);

    impl MemoryStore {
        fn new() -> Self {
            Self(Arc::new(Mutex::new(AppState::default())))
        }
    }

    impl StateRepository for MemoryStore {
        fn load(&self) -> Result<AppState, StoreError> {
            Ok(self.0.lock().unwrap().clone())
        }

        fn save(&self, state: &AppState) -> Result<(), StoreError> {
            *self.0.lock().unwrap() = state.clone();
            Ok(())
        }
    }

    fn weekly_input(types: Vec<&str>, weekdays: Vec<Weekday>) -> ScheduleInput {
        ScheduleInput {
            collection_type_ids: types.into_iter().map(str::to_owned).collect(),
            rule: ScheduleRule::Weekly { weekdays },
        }
    }

    #[test]
    fn creates_weekly_schedule_with_multiple_types_and_weekdays() {
        let service = AppService::open(MemoryStore::new()).unwrap();
        let schedule = service
            .create_schedule(weekly_input(
                vec!["system.combustible", "system.plastics", "system.plastics"],
                vec![Weekday::Monday, Weekday::Thursday, Weekday::Monday],
            ))
            .unwrap();

        assert!(!schedule.id.is_empty());
        assert_eq!(schedule.collection_type_ids.len(), 2);
        assert_eq!(
            schedule.rule,
            ScheduleRule::Weekly {
                weekdays: vec![Weekday::Monday, Weekday::Thursday]
            }
        );
        assert_eq!(
            service.list_schedules().unwrap()[0].recurrence_description,
            "Every Monday and Thursday"
        );
    }

    #[test]
    fn creates_monthly_schedule_with_multiple_ordinals() {
        let service = AppService::open(MemoryStore::new()).unwrap();
        let schedule = service
            .create_schedule(ScheduleInput {
                collection_type_ids: vec!["system.pet-bottles".to_owned()],
                rule: ScheduleRule::MonthlyNthWeekday {
                    weekday: Weekday::Wednesday,
                    ordinals: vec![2, 4],
                },
            })
            .unwrap();

        assert_eq!(
            schedule.rule,
            ScheduleRule::MonthlyNthWeekday {
                weekday: Weekday::Wednesday,
                ordinals: vec![2, 4]
            }
        );
        assert_eq!(
            service.list_schedules().unwrap()[0].recurrence_description,
            "2nd and 4th Wednesday of each month"
        );
    }

    #[test]
    fn update_preserves_id_and_delete_removes_only_the_schedule() {
        let service = AppService::open(MemoryStore::new()).unwrap();
        let created = service
            .create_schedule(weekly_input(
                vec!["system.combustible"],
                vec![Weekday::Monday],
            ))
            .unwrap();
        let updated = service
            .update_schedule(
                &created.id,
                weekly_input(vec!["system.glass"], vec![Weekday::Friday]),
            )
            .unwrap();

        assert_eq!(updated.id, created.id);
        service.delete_schedule(&created.id).unwrap();
        assert!(service.list_schedules().unwrap().is_empty());
        assert_eq!(service.list_collection_types().unwrap().len(), 8);
    }

    #[test]
    fn validation_rejects_invalid_schedule_inputs() {
        let service = AppService::open(MemoryStore::new()).unwrap();
        assert_eq!(
            service
                .create_schedule(weekly_input(vec![], vec![Weekday::Monday]))
                .unwrap_err(),
            "Choose at least one collection type."
        );
        assert!(service
            .create_schedule(weekly_input(vec!["missing"], vec![Weekday::Monday]))
            .unwrap_err()
            .contains("does not exist"));
        assert!(service
            .create_schedule(weekly_input(vec!["system.glass"], vec![]))
            .unwrap_err()
            .contains("at least one weekday"));
        assert!(service
            .create_schedule(ScheduleInput {
                collection_type_ids: vec!["system.glass".to_owned()],
                rule: ScheduleRule::MonthlyNthWeekday {
                    weekday: Weekday::Friday,
                    ordinals: vec![]
                }
            })
            .unwrap_err()
            .contains("at least one monthly occurrence"));
        assert!(service
            .create_schedule(ScheduleInput {
                collection_type_ids: vec!["system.glass".to_owned()],
                rule: ScheduleRule::MonthlyNthWeekday {
                    weekday: Weekday::Friday,
                    ordinals: vec![6]
                }
            })
            .unwrap_err()
            .contains("between 1st and 5th"));
    }

    #[test]
    fn created_schedules_persist_when_the_application_reopens() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir()
            .join(format!("trash-talk-schedule-persistence-{nonce}"))
            .join("state.json");
        let store = JsonStateStore::new(path);
        let service = AppService::open(store.clone()).unwrap();
        let created = service
            .create_schedule(weekly_input(
                vec!["system.cans-and-spray-cans"],
                vec![Weekday::Friday],
            ))
            .unwrap();
        drop(service);

        let reopened = AppService::open(store).unwrap();
        assert_eq!(reopened.get_schedule(&created.id).unwrap().id, created.id);
    }

    #[test]
    fn home_summary_follows_creates_edits_and_deletions() {
        let service = AppService::open(MemoryStore::new()).unwrap();
        let monday = NaiveDate::from_ymd_opt(2026, 9, 21).unwrap();
        let schedule = service
            .create_schedule(weekly_input(
                vec!["system.combustible"],
                vec![Weekday::Monday],
            ))
            .unwrap();
        assert_eq!(
            service
                .home_summary_for_date(monday)
                .unwrap()
                .today
                .collections
                .len(),
            1
        );

        service
            .update_schedule(
                &schedule.id,
                weekly_input(vec!["system.glass"], vec![Weekday::Tuesday]),
            )
            .unwrap();
        assert!(service
            .home_summary_for_date(monday)
            .unwrap()
            .today
            .collections
            .is_empty());
        service.delete_schedule(&schedule.id).unwrap();
        assert!(service
            .home_summary_for_date(monday.succ_opt().unwrap())
            .unwrap()
            .today
            .collections
            .is_empty());
    }

    #[test]
    fn home_summary_uses_distinct_today_and_tomorrow_dates() {
        let state = AppState::default();
        let summary = home_summary_for(&state, NaiveDate::from_ymd_opt(2026, 9, 25).unwrap());

        assert_ne!(summary.today.date, summary.tomorrow.date);
        assert_eq!(
            summary.tomorrow.date,
            NaiveDate::from_ymd_opt(2026, 9, 26).unwrap()
        );
        assert!(summary.today.collections.is_empty());
        assert!(summary.tomorrow.collections.is_empty());
    }

    #[test]
    fn tomorrow_crosses_month_and_year_boundaries() {
        assert_eq!(
            home_summary_for(
                &AppState::default(),
                NaiveDate::from_ymd_opt(2026, 1, 31).unwrap()
            )
            .tomorrow
            .date,
            NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()
        );
        assert_eq!(
            home_summary_for(
                &AppState::default(),
                NaiveDate::from_ymd_opt(2026, 12, 31).unwrap()
            )
            .tomorrow
            .date,
            NaiveDate::from_ymd_opt(2027, 1, 1).unwrap()
        );
    }

    #[test]
    fn calendar_range_has_seven_chronological_days_including_empty_days() {
        let days = calendar_days_for(
            &AppState::default(),
            NaiveDate::from_ymd_opt(2026, 9, 25).unwrap(),
            NaiveDate::from_ymd_opt(2026, 10, 1).unwrap(),
        )
        .unwrap();

        assert_eq!(days.len(), 7);
        assert_eq!(
            days.first().unwrap().date,
            NaiveDate::from_ymd_opt(2026, 9, 25).unwrap()
        );
        assert_eq!(
            days.last().unwrap().date,
            NaiveDate::from_ymd_opt(2026, 10, 1).unwrap()
        );
        assert!(days.iter().all(|day| day.collections.is_empty()));
        assert!(days.windows(2).all(|pair| pair[0].date < pair[1].date));
    }

    #[test]
    fn calendar_range_crosses_a_year_boundary() {
        let days = calendar_days_for(
            &AppState::default(),
            NaiveDate::from_ymd_opt(2026, 12, 29).unwrap(),
            NaiveDate::from_ymd_opt(2027, 1, 4).unwrap(),
        )
        .unwrap();

        assert_eq!(days.len(), 7);
        assert_eq!(days[3].date, NaiveDate::from_ymd_opt(2027, 1, 1).unwrap());
    }

    #[test]
    fn calendar_uses_existing_rules_and_deduplicates_types_per_day() {
        let mut state = AppState::default();
        state.schedules = vec![
            Schedule {
                id: "weekly".to_owned(),
                collection_type_ids: vec![
                    "system.combustible".to_owned(),
                    "system.glass".to_owned(),
                ],
                rule: ScheduleRule::Weekly {
                    weekdays: vec![Weekday::Monday],
                },
            },
            Schedule {
                id: "same-glass".to_owned(),
                collection_type_ids: vec!["system.glass".to_owned()],
                rule: ScheduleRule::Weekly {
                    weekdays: vec![Weekday::Monday],
                },
            },
            Schedule {
                id: "monthly".to_owned(),
                collection_type_ids: vec!["system.pet-bottles".to_owned()],
                rule: ScheduleRule::MonthlyNthWeekday {
                    weekday: Weekday::Wednesday,
                    ordinals: vec![2],
                },
            },
        ];
        let days = calendar_days_for(
            &state,
            NaiveDate::from_ymd_opt(2026, 9, 7).unwrap(),
            NaiveDate::from_ymd_opt(2026, 9, 14).unwrap(),
        )
        .unwrap();

        assert_eq!(days[0].collections.len(), 2);
        assert_eq!(days[2].collections[0].name, "PET Bottles");
        assert_eq!(days[7].collections.len(), 2);
    }

    #[test]
    fn calendar_periods_cover_month_lengths_and_december_rollover() {
        let state = AppState::default();
        let next_seven_days = calendar_period_for(
            &state,
            NaiveDate::from_ymd_opt(2026, 12, 28).unwrap(),
            CalendarPeriodKind::NextSevenDays,
        )
        .unwrap();
        assert_eq!(next_seven_days.days.len(), 7);
        assert_eq!(
            next_seven_days.end_date,
            NaiveDate::from_ymd_opt(2027, 1, 3).unwrap()
        );

        let february = calendar_period_for(
            &state,
            NaiveDate::from_ymd_opt(2026, 2, 12).unwrap(),
            CalendarPeriodKind::ThisMonth,
        )
        .unwrap();
        assert_eq!(february.days.len(), 28);

        let leap_february = calendar_period_for(
            &state,
            NaiveDate::from_ymd_opt(2028, 2, 12).unwrap(),
            CalendarPeriodKind::ThisMonth,
        )
        .unwrap();
        assert_eq!(leap_february.days.len(), 29);

        let april = calendar_period_for(
            &state,
            NaiveDate::from_ymd_opt(2026, 4, 12).unwrap(),
            CalendarPeriodKind::ThisMonth,
        )
        .unwrap();
        assert_eq!(april.days.len(), 30);

        let may = calendar_period_for(
            &state,
            NaiveDate::from_ymd_opt(2026, 5, 12).unwrap(),
            CalendarPeriodKind::ThisMonth,
        )
        .unwrap();
        assert_eq!(may.days.len(), 31);

        let january = calendar_period_for(
            &state,
            NaiveDate::from_ymd_opt(2026, 12, 12).unwrap(),
            CalendarPeriodKind::NextMonth,
        )
        .unwrap();
        assert_eq!(
            january.start_date,
            NaiveDate::from_ymd_opt(2027, 1, 1).unwrap()
        );
        assert_eq!(
            january.end_date,
            NaiveDate::from_ymd_opt(2027, 1, 31).unwrap()
        );
    }

    #[test]
    fn calendar_reflects_schedule_edits_and_deletions() {
        let service = AppService::open(MemoryStore::new()).unwrap();
        let schedule = service
            .create_schedule(weekly_input(
                vec!["system.combustible"],
                vec![Weekday::Monday],
            ))
            .unwrap();
        assert_eq!(
            service
                .collection_calendar("2026-09-21", "2026-09-21")
                .unwrap()[0]
                .collections[0]
                .name,
            "Combustible"
        );
        service
            .update_schedule(
                &schedule.id,
                weekly_input(vec!["system.plastics"], vec![Weekday::Tuesday]),
            )
            .unwrap();
        assert!(service
            .collection_calendar("2026-09-21", "2026-09-21")
            .unwrap()[0]
            .collections
            .is_empty());
        assert_eq!(
            service
                .collection_calendar("2026-09-22", "2026-09-22")
                .unwrap()[0]
                .collections[0]
                .name,
            "Plastics"
        );
        service.delete_schedule(&schedule.id).unwrap();
        assert!(service
            .collection_calendar("2026-09-22", "2026-09-22")
            .unwrap()[0]
            .collections
            .is_empty());
    }
}
