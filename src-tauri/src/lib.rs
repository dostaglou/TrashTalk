mod application;
mod domain;
mod storage;

use application::{AppService, HomeSummary};
use storage::JsonStateStore;
use tauri::Manager;

type RuntimeAppService = AppService<JsonStateStore>;

#[tauri::command]
fn get_home_summary(service: tauri::State<'_, RuntimeAppService>) -> Result<HomeSummary, String> {
    service.home_summary()
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
        .invoke_handler(tauri::generate_handler![get_home_summary])
        .run(tauri::generate_context!())
        .expect("error while running TrashTalk");
}
