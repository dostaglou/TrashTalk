use crate::domain::{collections_for_date, AppState, CollectionType};
use crate::storage::{StateRepository, StoreError};
use chrono::{Local, NaiveDate};
use serde::Serialize;
use std::sync::Mutex;

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

/// Application layer: owns loaded state and exposes presentation-oriented operations.
pub struct AppService<R: StateRepository> {
    _repository: R,
    state: Mutex<AppState>,
}

impl<R: StateRepository> AppService<R> {
    pub fn open(repository: R) -> Result<Self, StoreError> {
        let state = repository.load_or_initialize()?;
        Ok(Self {
            _repository: repository,
            state: Mutex::new(state),
        })
    }

    pub fn home_summary(&self) -> Result<HomeSummary, String> {
        let today = Local::now().date_naive();
        let state = self
            .state
            .lock()
            .map_err(|_| "application state is unavailable".to_owned())?;
        Ok(home_summary_for(&state, today))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn tomorrow_crosses_a_month_boundary() {
        let summary = home_summary_for(
            &AppState::default(),
            NaiveDate::from_ymd_opt(2026, 1, 31).unwrap(),
        );

        assert_eq!(
            summary.tomorrow.date,
            NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()
        );
    }

    #[test]
    fn tomorrow_crosses_a_year_boundary() {
        let summary = home_summary_for(
            &AppState::default(),
            NaiveDate::from_ymd_opt(2026, 12, 31).unwrap(),
        );

        assert_eq!(
            summary.tomorrow.date,
            NaiveDate::from_ymd_opt(2027, 1, 1).unwrap()
        );
    }
}
