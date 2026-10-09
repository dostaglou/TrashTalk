mod application;
mod domain;
mod notifications;
mod storage;

use application::{
    AppError, AppService, CalendarDay, CalendarPeriod, CalendarPeriodKind, HomeSummary,
    ScheduleSummary,
};
use domain::{CollectionType, Locale, NotificationSettings, Schedule, ScheduleInput};
use notifications::PlannedNotification;
use storage::JsonStateStore;
use tauri::Manager;

type RuntimeAppService = AppService<JsonStateStore>;

#[tauri::command]
fn get_home_summary(service: tauri::State<'_, RuntimeAppService>) -> Result<HomeSummary, AppError> {
    service.home_summary()
}

#[tauri::command]
fn get_collection_calendar(
    start_date: String,
    end_date: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<CalendarDay>, AppError> {
    service.collection_calendar(&start_date, &end_date)
}

#[tauri::command]
fn get_calendar_period(
    period: CalendarPeriodKind,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<CalendarPeriod, AppError> {
    service.calendar_period(period)
}

#[tauri::command]
fn list_collection_types(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<CollectionType>, AppError> {
    service.list_collection_types()
}

#[tauri::command]
fn create_custom_collection_type(
    name: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<CollectionType, AppError> {
    service.create_custom_collection_type(name)
}

#[tauri::command]
fn delete_custom_collection_type(
    id: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<(), AppError> {
    service.delete_custom_collection_type(&id)
}

#[tauri::command]
fn get_notification_settings(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<NotificationSettings, AppError> {
    service.notification_settings()
}

#[tauri::command]
fn save_notification_settings(
    settings: NotificationSettings,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<NotificationSettings, AppError> {
    service.save_notification_settings(settings)
}

#[tauri::command]
fn get_notification_plan(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<PlannedNotification>, AppError> {
    service.notification_plan()
}

#[tauri::command]
fn list_schedules(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<ScheduleSummary>, AppError> {
    service.list_schedules()
}

#[tauri::command]
fn get_schedule(
    id: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Schedule, AppError> {
    service.get_schedule(&id)
}

#[tauri::command]
fn create_schedule(
    input: ScheduleInput,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Schedule, AppError> {
    service.create_schedule(input)
}

#[tauri::command]
fn update_schedule(
    id: String,
    input: ScheduleInput,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Schedule, AppError> {
    service.update_schedule(&id, input)
}

#[tauri::command]
fn delete_schedule(
    id: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<(), AppError> {
    service.delete_schedule(&id)
}

#[tauri::command]
fn get_locale(service: tauri::State<'_, RuntimeAppService>) -> Result<Option<Locale>, AppError> {
    service.locale()
}

#[tauri::command]
fn save_locale(
    locale: Locale,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Locale, AppError> {
    service.save_locale(locale)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let state_path = app.path().app_data_dir()?.join("state.json");
            let service = RuntimeAppService::open(JsonStateStore::new(state_path))?;
            app.manage(service);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_home_summary,
            get_collection_calendar,
            get_calendar_period,
            list_collection_types,
            create_custom_collection_type,
            delete_custom_collection_type,
            get_notification_settings,
            save_notification_settings,
            get_notification_plan,
            get_locale,
            save_locale,
            list_schedules,
            get_schedule,
            create_schedule,
            update_schedule,
            delete_schedule
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrashTalk");
}
