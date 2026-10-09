const messages = {
  en: {
    "app.title": "TrashTalk",
    "nav.home": "Home",
    "nav.main": "Main navigation",
    "nav.brand": "TrashTalk home",
    "nav.calendar": "Calendar",
    "nav.schedules": "Schedules",
    "nav.alerts": "Alerts",
    "nav.settings": "Settings",
    "home.schedule": "Your collection schedule",
    "home.today": "Today",
    "home.tomorrow": "Tomorrow",
    "home.loading": "Checking your schedule…",
    "home.loading_date": "Loading date…",
    "home.unavailable": "Schedule unavailable",
    "home.collection": "Collection",
    "home.no_collection": "No collection",
    "home.no_today_detail": "Enjoy a rubbish-free day.",
    "home.no_tomorrow_detail": "There is nothing to put out yet.",
    "home.put_out_today": "Put these out for collection today.",
    "home.prepare_tonight": "Get these ready tonight.",
    "calendar.eyebrow": "Plan ahead",
    "calendar.next_seven_days": "Next 7 days",
    "calendar.this_month": "This month",
    "calendar.next_month": "Next month",
    "calendar.view": "Calendar view",
    "calendar.no_collection": "No collection",
    "calendar.no_collection_scheduled": "No collection scheduled",
    "schedules.eyebrow": "Your routines",
    "schedules.add": "Add",
    "schedules.no_schedules": "No schedules yet",
    "schedules.get_started": "Add your first collection day to get started.",
    "schedules.add_schedule": "Add a schedule",
    "schedules.personalise": "Personalise",
    "schedules.custom_types": "Custom trash types",
    "schedules.custom_empty": "Custom trash types you create will appear here.",
    "schedules.remove": "Remove",
    "schedules.edit": "Edit",
    "schedules.delete_confirm": "Delete the {types} schedule?",
    "form.new_routine": "New routine",
    "form.update_routine": "Update routine",
    "form.add_schedule": "Add a schedule",
    "form.edit_schedule": "Edit schedule",
    "form.choose_intro": "Choose what goes out and which days it is collected.",
    "form.collection_types": "Collection types",
    "form.collection_hint": "Choose everything collected on this schedule.",
    "form.custom_type": "Custom trash type",
    "form.custom_placeholder": "e.g. Batteries",
    "form.optional_characters": "Optional. Enter 1–100 characters.",
    "form.repeat": "Repeat",
    "form.every_week": "Every week",
    "form.monthly": "Monthly",
    "form.collection_days": "Collection days",
    "form.monthly_collection": "Monthly collection",
    "form.day_of_week": "Day of the week",
    "form.choose_day": "Choose a day",
    "form.which_occurrence": "Which occurrence?",
    "form.save_changes": "Save changes",
    "form.save_schedule": "Add schedule",
    "notifications.eyebrow": "Your reminders",
    "notifications.title": "Notifications",
    "notifications.intro": "Choose broad delivery times for local Android reminders. Delivery may be a little later to preserve battery life.",
    "notifications.day_of": "Day of",
    "notifications.day_of_description": "A reminder on collection day.",
    "notifications.day_before": "Day before",
    "notifications.day_before_description": "Time to get tomorrow's collection ready.",
    "notifications.enable_day_of": "Enable day-of reminders",
    "notifications.enable_day_before": "Enable day-before reminders",
    "notifications.morning": "Morning",
    "notifications.mid_morning": "Mid morning",
    "notifications.evening": "Evening",
    "notifications.late_evening": "Late evening",
    "notifications.custom": "Custom",
    "notifications.select": "Select",
    "notifications.choose_custom": "Choose custom reminder time",
    "notifications.save": "Save reminder settings",
    "notifications.channel_name": "TrashTalk reminders",
    "notifications.channel_description": "Upcoming trash collection reminders",
    "notifications.saved": "Settings saved.",
    "notifications.saved_off": "Settings saved. Reminders are off.",
    "notifications.permission_denied": "Settings saved. Android notification permission was not granted, so reminders are not scheduled.",
    "notifications.unavailable": "Settings saved, but Android reminders could not be scheduled on this device.",
    "settings.eyebrow": "Preferences",
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.language_hint": "Choose the language used throughout TrashTalk.",
    "settings.english": "English",
    "settings.japanese": "日本語",
    "settings.device_language": "Device language",
    "settings.device_language_hint": "Currently using {language}.",
    "status.loading": "Loading…",
    "status.restart": "Unable to load data. Please restart TrashTalk.",
    "status.calendar_restart": "Unable to load the calendar. Please restart TrashTalk.",
    "status.settings_restart": "Unable to load settings. Please restart TrashTalk.",
    "errors.collection_type_name": "Custom trash type must be between 1 and 100 characters.",
    "errors.collection_type_not_found": "Collection type not found.",
    "errors.system_collection_type": "System collection types cannot be deleted.",
    "errors.schedule_not_found": "Schedule not found.",
    "errors.no_collection_types": "Choose at least one collection type.",
    "errors.collection_type_missing": "The selected collection type does not exist.",
    "errors.no_weekdays": "Choose at least one weekday for a weekly schedule.",
    "errors.no_monthly_occurrences": "Choose at least one monthly occurrence.",
    "errors.monthly_ordinal": "Monthly occurrence must be between 1st and 5th.",
    "errors.calendar_end": "The calendar end date must be on or after the start date.",
    "errors.calendar_date": "The calendar {boundary} date must use YYYY-MM-DD.",
    "errors.calendar_range": "The requested calendar range is too large.",
    "errors.state": "Application state is unavailable.",
    "errors.save": "Unable to save application state.",
    "errors.unknown": "Something went wrong. Please try again.",
    "days.sunday": "Sunday",
    "days.monday": "Monday",
    "days.tuesday": "Tuesday",
    "days.wednesday": "Wednesday",
    "days.thursday": "Thursday",
    "days.friday": "Friday",
    "days.saturday": "Saturday",
    "recurrence.every": "Every {days}",
    "recurrence.monthly": "{ordinals} {weekday} of each month",
    "recurrence.ordinal_1": "1st",
    "recurrence.ordinal_2": "2nd",
    "recurrence.ordinal_3": "3rd",
    "recurrence.ordinal_4": "4th",
    "recurrence.ordinal_5": "5th",
    "notification.nothing_today": "Nothing to put out today",
    "notification.nothing_tomorrow": "Nothing to put out tomorrow",
    "notification.today_trash": "Today's trash: {collections}",
    "notification.tomorrow_trash": "Tomorrow's trash: {collections}",
    "collection.combustible": "Combustible",
    "collection.plastics": "Plastics",
    "collection.pet_bottles": "PET Bottles",
    "collection.unburnables": "Unburnables",
    "collection.glass": "Glass",
    "collection.cans": "Cans",
    "collection.paper_goods": "Paper goods",
    "collection.appliances": "Appliances",
  },
  ja: {
    "app.title": "TrashTalk",
    "nav.home": "ホーム",
    "nav.main": "メインナビゲーション",
    "nav.brand": "TrashTalkホーム",
    "nav.calendar": "カレンダー",
    "nav.schedules": "予定",
    "nav.alerts": "通知",
    "nav.settings": "設定",
    "home.schedule": "ごみ収集予定",
    "home.today": "今日",
    "home.tomorrow": "明日",
    "home.loading": "予定を確認しています…",
    "home.loading_date": "日付を読み込んでいます…",
    "home.unavailable": "予定を読み込めません",
    "home.collection": "収集",
    "home.no_collection": "収集なし",
    "home.no_today_detail": "今日は出すごみはありません。",
    "home.no_tomorrow_detail": "明日出すごみはありません。",
    "home.put_out_today": "今日の収集に出してください。",
    "home.prepare_tonight": "今夜準備してください。",
    "calendar.eyebrow": "先の予定",
    "calendar.next_seven_days": "今後7日間",
    "calendar.this_month": "今月",
    "calendar.next_month": "来月",
    "calendar.view": "カレンダー表示",
    "calendar.no_collection": "収集なし",
    "calendar.no_collection_scheduled": "収集予定なし",
    "schedules.eyebrow": "収集ルーティン",
    "schedules.add": "追加",
    "schedules.no_schedules": "予定はまだありません",
    "schedules.get_started": "最初の収集日を追加しましょう。",
    "schedules.add_schedule": "予定を追加",
    "schedules.personalise": "カスタマイズ",
    "schedules.custom_types": "カスタムごみ種類",
    "schedules.custom_empty": "作成したカスタムごみ種類がここに表示されます。",
    "schedules.remove": "削除",
    "schedules.edit": "編集",
    "schedules.delete_confirm": "{types}の予定を削除しますか？",
    "form.new_routine": "新しいルーティン",
    "form.update_routine": "ルーティンを更新",
    "form.add_schedule": "予定を追加",
    "form.edit_schedule": "予定を編集",
    "form.choose_intro": "出すごみと収集日を選択します。",
    "form.collection_types": "ごみの種類",
    "form.collection_hint": "この予定で収集されるものをすべて選択します。",
    "form.custom_type": "カスタムごみ種類",
    "form.custom_placeholder": "例：電池",
    "form.optional_characters": "任意。1〜100文字で入力してください。",
    "form.repeat": "繰り返し",
    "form.every_week": "毎週",
    "form.monthly": "毎月",
    "form.collection_days": "収集曜日",
    "form.monthly_collection": "毎月の収集",
    "form.day_of_week": "曜日",
    "form.choose_day": "曜日を選択",
    "form.which_occurrence": "何週目？",
    "form.save_changes": "変更を保存",
    "form.save_schedule": "予定を追加",
    "notifications.eyebrow": "通知設定",
    "notifications.title": "通知",
    "notifications.intro": "Androidのごみ収集通知のおおよその時刻を選択します。電池を節約するため、通知は少し遅れる場合があります。",
    "notifications.day_of": "当日",
    "notifications.day_of_description": "収集日に通知します。",
    "notifications.day_before": "前日",
    "notifications.day_before_description": "明日の収集に備えるための通知です。",
    "notifications.enable_day_of": "当日の通知を有効にする",
    "notifications.enable_day_before": "前日の通知を有効にする",
    "notifications.morning": "朝",
    "notifications.mid_morning": "午前中",
    "notifications.evening": "夕方",
    "notifications.late_evening": "夜",
    "notifications.custom": "カスタム",
    "notifications.select": "選択",
    "notifications.choose_custom": "カスタム通知時刻を選択",
    "notifications.save": "通知設定を保存",
    "notifications.channel_name": "TrashTalk通知",
    "notifications.channel_description": "今後のごみ収集通知",
    "notifications.saved": "設定を保存しました。",
    "notifications.saved_off": "設定を保存しました。通知はオフです。",
    "notifications.permission_denied": "設定を保存しました。Androidの通知許可がないため、通知は予定されていません。",
    "notifications.unavailable": "設定を保存しましたが、この端末ではAndroid通知を予定できませんでした。",
    "settings.eyebrow": "環境設定",
    "settings.title": "設定",
    "settings.language": "言語",
    "settings.language_hint": "TrashTalkで使用する言語を選択します。",
    "settings.english": "English",
    "settings.japanese": "日本語",
    "settings.device_language": "端末の言語",
    "settings.device_language_hint": "現在は{language}を使用しています。",
    "status.loading": "読み込み中…",
    "status.restart": "データを読み込めません。TrashTalkを再起動してください。",
    "status.calendar_restart": "カレンダーを読み込めません。TrashTalkを再起動してください。",
    "status.settings_restart": "設定を読み込めません。TrashTalkを再起動してください。",
    "errors.collection_type_name": "カスタムごみ種類は1〜100文字で入力してください。",
    "errors.collection_type_not_found": "ごみ種類が見つかりません。",
    "errors.system_collection_type": "システムごみ種類は削除できません。",
    "errors.schedule_not_found": "予定が見つかりません。",
    "errors.no_collection_types": "ごみ種類を1つ以上選択してください。",
    "errors.collection_type_missing": "選択したごみ種類が存在しません。",
    "errors.no_weekdays": "毎週の予定には曜日を1つ以上選択してください。",
    "errors.no_monthly_occurrences": "毎月の予定には週を1つ以上選択してください。",
    "errors.monthly_ordinal": "月の週は1週目から5週目の間で選択してください。",
    "errors.calendar_end": "カレンダーの終了日は開始日以降にしてください。",
    "errors.calendar_date": "カレンダーの{boundary}日はYYYY-MM-DD形式で入力してください。",
    "errors.calendar_range": "指定されたカレンダー範囲が大きすぎます。",
    "errors.state": "アプリの状態を利用できません。",
    "errors.save": "アプリの状態を保存できません。",
    "errors.unknown": "問題が発生しました。もう一度お試しください。",
    "days.sunday": "日曜日",
    "days.monday": "月曜日",
    "days.tuesday": "火曜日",
    "days.wednesday": "水曜日",
    "days.thursday": "木曜日",
    "days.friday": "金曜日",
    "days.saturday": "土曜日",
    "recurrence.every": "毎週{days}",
    "recurrence.monthly": "毎月{weekday}の{ordinals}",
    "recurrence.ordinal_1": "1週目",
    "recurrence.ordinal_2": "2週目",
    "recurrence.ordinal_3": "3週目",
    "recurrence.ordinal_4": "4週目",
    "recurrence.ordinal_5": "5週目",
    "notification.nothing_today": "今日は出すごみはありません",
    "notification.nothing_tomorrow": "明日は出すごみはありません",
    "notification.today_trash": "今日のごみ：{collections}",
    "notification.tomorrow_trash": "明日のごみ：{collections}",
    "collection.combustible": "燃えるゴミ",
    "collection.plastics": "プラスチック",
    "collection.pet_bottles": "ペットボトル",
    "collection.unburnables": "燃えないゴミ",
    "collection.glass": "ガラス",
    "collection.cans": "缶",
    "collection.paper_goods": "紙類",
    "collection.appliances": "家電",
  },
};

let activeLocale = "en";

export function deviceLocale() {
  return navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function setLocale(locale) {
  activeLocale = locale === "ja" || locale === "japanese" ? "ja" : "en";
  document.documentElement.lang = activeLocale;
  document.title = t("app.title");
}

export function getLocale() {
  return activeLocale;
}

export function localeForBackend() {
  return activeLocale === "ja" ? "japanese" : "english";
}

export function languageName(locale = activeLocale) {
  return locale === "ja" || locale === "japanese" ? t("settings.japanese") : t("settings.english");
}

export function shortWeekdayLabels() {
  return activeLocale === "ja" ? ["日", "月", "火", "水", "木", "金", "土"] : ["S", "M", "T", "W", "T", "F", "S"];
}

export function t(key, values = {}) {
  const template = messages[activeLocale][key] || messages.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

export function translateDocument(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

export function collectionLabel(collection) {
  if (collection.key?.kind === "custom") return collection.key.name;
  return t(`collection.${collection.key?.kind || "unknown"}`);
}

function listWords(items) {
  if (items.length < 2) return items[0] || "";
  if (activeLocale === "ja") return items.join("、");
  if (items.length === 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export function recurrenceLabel(rule) {
  if (rule.kind === "weekly") {
    return t("recurrence.every", {
      days: listWords(rule.weekdays.map((day) => t(`days.${day}`))),
    });
  }
  const ordinals = listWords(rule.ordinals.map((ordinal) => t(`recurrence.ordinal_${ordinal}`)));
  return t("recurrence.monthly", { ordinals, weekday: t(`days.${rule.weekday}`) });
}

export function notificationText(notification) {
  const collections = listWords(notification.collections.map(collectionLabel));
  const isBefore = notification.reminderType === "day_before";
  if (!collections) return t(isBefore ? "notification.nothing_tomorrow" : "notification.nothing_today");
  return t(isBefore ? "notification.tomorrow_trash" : "notification.today_trash", { collections });
}

export function localizedError(error) {
  let value = error;
  if (typeof error === "string") {
    try {
      value = JSON.parse(error);
    } catch {
      value = null;
    }
  }
  const code = value?.code;
  if (!code) return typeof error === "string" && error ? error : t("errors.unknown");
  const details = value.details || value;
  const keys = {
    collection_type_name_invalid: "errors.collection_type_name",
    collection_type_not_found: "errors.collection_type_not_found",
    system_collection_type_protected: "errors.system_collection_type",
    schedule_not_found: "errors.schedule_not_found",
    no_collection_types: "errors.no_collection_types",
    collection_type_does_not_exist: "errors.collection_type_missing",
    no_weekly_weekdays: "errors.no_weekdays",
    no_monthly_occurrences: "errors.no_monthly_occurrences",
    monthly_ordinal_out_of_range: "errors.monthly_ordinal",
    calendar_end_before_start: "errors.calendar_end",
    calendar_date_invalid: "errors.calendar_date",
    calendar_range_too_large: "errors.calendar_range",
    state_unavailable: "errors.state",
    unable_to_save_state: "errors.save",
  };
  return t(keys[code] || "errors.unknown", details);
}
