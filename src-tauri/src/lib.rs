mod application;
mod domain;
mod storage;

use application::{AppService, HomeSummary, ScheduleSummary};
use domain::{CollectionType, Schedule, ScheduleInput};
use storage::JsonStateStore;
use tauri::Manager;

type RuntimeAppService = AppService<JsonStateStore>;

#[tauri::command]
fn get_home_summary(service: tauri::State<'_, RuntimeAppService>) -> Result<HomeSummary, String> {
    service.home_summary()
}

#[tauri::command]
fn list_collection_types(
    service: tauri::State<'_, RuntimeAppService>,
) -> Result<Vec<CollectionType>, String> {
    service.list_collection_types()
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
        .setup(|app| {
            let state_path = app.path().app_data_dir()?.join("state.json");
            let service = RuntimeAppService::open(JsonStateStore::new(state_path))?;
            app.manage(service);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_home_summary,
            list_collection_types,
            list_schedules,
            get_schedule,
            create_schedule,
            update_schedule,
            delete_schedule
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrashTalk");
}
