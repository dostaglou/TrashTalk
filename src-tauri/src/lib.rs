mod application;
mod domain;
mod notifications;
mod storage;

use application::{
    AppService, CalendarDay, CalendarPeriod, CalendarPeriodKind, HomeSummary, ScheduleSummary,
};
use domain::{CollectionType, NotificationSettings, Schedule, ScheduleInput};
use notifications::PlannedNotification;
use storage::JsonStateStore;
use tauri::Manager;

type RuntimeAppService = AppService<JsonStateStore>;

#[tauri::command]
fn get_home_summary(service: tauri::State<'_, RuntimeAppService>) -> Result<HomeSummary, String> {
    service.home_summary()
}

#[tauri::command]
fn get_collection_calendar(
    start_date: String,
    end_date: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<CalendarDay>, String> {
    service.collection_calendar(&start_date, &end_date)
}

#[tauri::command]
fn get_calendar_period(
    period: CalendarPeriodKind,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<CalendarPeriod, String> {
    service.calendar_period(period)
}

#[tauri::command]
fn list_collection_types(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<CollectionType>, String> {
    service.list_collection_types()
}

#[tauri::command]
fn create_custom_collection_type(
    name: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<CollectionType, String> {
    service.create_custom_collection_type(name)
}

#[tauri::command]
fn delete_custom_collection_type(
    id: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<(), String> {
    service.delete_custom_collection_type(&id)
}

#[tauri::command]
fn get_notification_settings(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<NotificationSettings, String> {
    service.notification_settings()
}

#[tauri::command]
fn save_notification_settings(
    settings: NotificationSettings,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<NotificationSettings, String> {
    service.save_notification_settings(settings)
}

#[tauri::command]
fn get_notification_plan(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<PlannedNotification>, String> {
    service.notification_plan()
}

#[tauri::command]
fn list_schedules(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<ScheduleSummary>, String> {
    service.list_schedules()
}

#[tauri::command]
fn get_schedule(
    id: String,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Schedule, String> {
    service.get_schedule(&id)
}

#[tauri::command]
fn create_schedule(
    input: ScheduleInput,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Schedule, String> {
    service.create_schedule(input)
}

#[tauri::command]
fn update_schedule(
    id: String,
    input: ScheduleInput,
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Schedule, String> {
    service.update_schedule(&id, input)
}

#[tauri::command]
fn delete_schedule(id: String, service: tauri::State<'_, RuntimeAppService>) -> Result<(), String> {
    service.delete_schedule(&id)
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
            list_schedules,
            get_schedule,
            create_schedule,
            update_schedule,
            delete_schedule
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrashTalk");
}
