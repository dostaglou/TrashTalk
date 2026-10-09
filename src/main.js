import appliancesIcon from "./assets/collection-types/appliances.svg";
import canisterIcon from "./assets/collection-types/canister.svg";
import cardboardIcon from "./assets/collection-types/cardboard.svg";
import combustibleIcon from "./assets/collection-types/flame.svg";
import customIcon from "./assets/collection-types/custom.svg";
import glassIcon from "./assets/collection-types/glass.svg";
import petBottleIcon from "./assets/collection-types/pet-bottle.svg";
import plasticsIcon from "./assets/collection-types/recycle.svg";
import unburnablesIcon from "./assets/collection-types/unburnables.svg";
import brandMark from "./assets/trashtalk-mark.svg";
import {
  collectionLabel,
  deviceLocale,
  getLocale,
  languageName,
  localizedError,
  notificationText,
  recurrenceLabel,
  setLocale,
  shortWeekdayLabels,
  t,
  translateDocument,
} from "./i18n.js";
import {
  Importance,
  Schedule as NotificationSchedule,
  cancel,
  createChannel,
  isPermissionGranted,
  pending,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const { invoke } = window.__TAURI__.core;

const weekdays = [
  ["sunday", "days.sunday"],
  ["monday", "days.monday"],
  ["tuesday", "days.tuesday"],
  ["wednesday", "days.wednesday"],
  ["thursday", "days.thursday"],
  ["friday", "days.friday"],
  ["saturday", "days.saturday"],
];

const defaultReminderTimes = {
  "day-of": "06:00",
  "day-before": "18:00",
};

const collectionPresentation = {
  combustible: { icon: combustibleIcon, color: "#fb923c", tint: "#fff1e6" },
  plastics: { icon: plasticsIcon, color: "#2dd4bf", tint: "#e4fbf6" },
  pet_bottles: { icon: petBottleIcon, color: "#60a5fa", tint: "#eaf3ff" },
  unburnables: { icon: unburnablesIcon, color: "#64748b", tint: "#edf1f5" },
  glass: { icon: glassIcon, color: "#c084fc", tint: "#f4ebff" },
  cans: { icon: canisterIcon, color: "#94a3b8", tint: "#f0f4f7" },
  paper_goods: { icon: cardboardIcon, color: "#fbbf24", tint: "#fff6d9" },
  appliances: { icon: appliancesIcon, color: "#f472b6", tint: "#ffebf5" },
  custom: { icon: customIcon, color: "#a78bfa", tint: "#f2edff" },
};

let editingScheduleId = null;
const primaryViews = ["home", "calendar", "schedules", "notifications", "settings"];
let activePrimaryView = "home";

const reminderChannel = {
  importance: Importance.Default,
  vibration: true,
  sound: "notification_ping",
};

function presentationFor(collection) {
  return collectionPresentation[collection.key?.kind] || collectionPresentation.custom;
}

function collectionIcon(collection, className = "collection-type-icon") {
  const presentation = presentationFor(collection);
  const icon = document.createElement("img");
  icon.className = className;
  icon.src = presentation.icon;
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function collectionIconList(collections, className = "collection-icon-list") {
  const list = document.createElement("span");
  list.className = className;
  collections.forEach((collection) => list.append(collectionIcon(collection)));
  return list;
}

function collectionChips(collections, className = "collection-chips") {
  const chips = document.createElement("span");
  chips.className = className;
  collections.forEach((collection) => {
    const presentation = presentationFor(collection);
    const chip = document.createElement("span");
    chip.className = "collection-chip";
    chip.style.setProperty("--type-color", presentation.color);
    chip.style.setProperty("--type-tint", presentation.tint);
    chip.append(collectionIcon(collection), document.createTextNode(collectionLabel(collection)));
    chips.append(chip);
  });
  return chips;
}

function localDateFromIso(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(localDateFromIso(isoDate));
}

function setText(selector, text) {
  document.querySelector(selector).textContent = text;
}

function renderDay(day, prefix) {
  setText(`#${prefix}-date`, formatDate(day.date));
  const content = document.querySelector(`#${prefix}-content`);
  content.replaceChildren();
  const title = document.createElement("p");
  const detail = document.createElement("p");
  detail.className = "collection-detail";

  if (day.collections.length === 0) {
    title.className = "collection-title collection-title--empty";
    title.textContent = t("calendar.no_collection_scheduled");
    detail.textContent = prefix === "today" ? t("home.no_today_detail") : t("home.no_tomorrow_detail");
  } else {
    title.className = "collection-title";
    title.append(
      collectionIconList(day.collections, "collection-icon-list collection-icon-list--title"),
      document.createTextNode(day.collections.map(collectionLabel).join(", ")),
    );
    detail.textContent = prefix === "today" ? t("home.put_out_today") : t("home.prepare_tonight");
  }
  content.append(title, detail);
}

async function loadHomeSummary() {
  try {
    const summary = await invoke("get_home_summary");
    renderDay(summary.today, "today");
    renderDay(summary.tomorrow, "tomorrow");
  } catch (error) {
    ["today", "tomorrow"].forEach((prefix) => {
      setText(`#${prefix}-date`, t("home.unavailable"));
      setText(`#${prefix}-content`, t("status.restart"));
    });
    console.error("Unable to load the Home summary", error);
  }
}

function showView(name) {
  const isPrimaryView = primaryViews.includes(name);
  if (isPrimaryView) activePrimaryView = name;
  document.querySelectorAll(".view").forEach((view) => view.classList.add("is-hidden"));
  document.querySelector(`#${name}-view`).classList.remove("is-hidden");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("nav-link--active", button.dataset.view === activePrimaryView);
  });
  if (name === "home") loadHomeSummary();
  if (name === "calendar") loadCalendar();
  if (name === "schedules") loadSchedules();
  if (name === "notifications") loadNotificationSettings();
  if (name === "settings") loadSettings();
}

function installPrimaryViewSwipeNavigation() {
  const shell = document.querySelector(".app-shell");
  const minimumSwipeDistance = 72;
  const horizontalRatio = 1.4;
  let gesture = null;

  const startsOnInteractiveChild = (target) => target.closest(
    "button, a, input, select, textarea, [role=tab], [data-swipe-exempt]",
  );

  shell.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1 || startsOnInteractiveChild(event.target)) {
      gesture = null;
      return;
    }
    const touch = event.touches[0];
    gesture = { startX: touch.clientX, startY: touch.clientY, direction: null };
  }, { passive: true });

  shell.addEventListener("touchmove", (event) => {
    if (!gesture || event.touches.length !== 1 || gesture.direction) return;
    const touch = event.touches[0];
    const horizontal = Math.abs(touch.clientX - gesture.startX);
    const vertical = Math.abs(touch.clientY - gesture.startY);
    if (vertical > horizontal + 12) gesture.direction = "vertical";
    if (horizontal > vertical + 12) gesture.direction = "horizontal";
  }, { passive: true });

  shell.addEventListener("touchend", (event) => {
    if (!gesture || gesture.direction === "vertical" || event.changedTouches.length !== 1) {
      gesture = null;
      return;
    }
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    gesture = null;
    if (Math.abs(deltaX) < minimumSwipeDistance || Math.abs(deltaX) < Math.abs(deltaY) * horizontalRatio) return;

    const currentIndex = primaryViews.indexOf(activePrimaryView);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= primaryViews.length) return;
    showView(primaryViews[nextIndex]);
  }, { passive: true });
}

function localDateTimeFromRust(value) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = "0"] = time.split(":");
  return new Date(year, month - 1, day, Number(hour), Number(minute), Number(second));
}

async function reconcileNativeNotifications({ requestPermission: shouldRequestPermission = false } = {}) {
  try {
    const settings = await invoke("get_notification_settings");
    let granted = await isPermissionGranted();
    if (!granted && shouldRequestPermission) granted = (await requestPermission()) === "granted";
    if (!settings.dayBefore.enabled && !settings.dayOf.enabled) {
      if (granted) await cancelTrashTalkNotifications();
      return { scheduled: 0, permission: "not-needed" };
    }
    if (!granted) return { scheduled: 0, permission: "denied" };

    await cancelTrashTalkNotifications();
    const channel = {
      ...reminderChannel,
      id: `trash-talk-reminders-${getLocale()}`,
      name: t("notifications.channel_name"),
      description: t("notifications.channel_description"),
    };
    await createChannel(channel);
    const plan = await invoke("get_notification_plan");
    plan.forEach((notification) => {
      sendNotification({
        id: notification.id,
        channelId: channel.id,
        title: notificationText(notification),
        body: "",
        icon: "trashtalk_notification",
        iconColor: "#d99a25",
        schedule: NotificationSchedule.at(localDateTimeFromRust(notification.scheduledAt), false, true),
      });
    });
    return { scheduled: plan.length, permission: "granted" };
  } catch (error) {
    console.error("Unable to reconcile local notifications", error);
    return { scheduled: 0, permission: "unavailable", error };
  }
}

async function cancelTrashTalkNotifications() {
  // All TrashTalk IDs are negative; never cancel another subsystem's notification IDs.
  const existing = await pending();
  const priorTrashTalkIds = existing.map((notification) => notification.id).filter((id) => id < 0);
  if (priorTrashTalkIds.length) await cancel(priorTrashTalkIds);
}

function makeButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function loadSchedules() {
  const list = document.querySelector("#schedule-list");
  list.replaceChildren();
  try {
    const [schedules, collectionTypes] = await Promise.all([
      invoke("list_schedules"),
      invoke("list_collection_types"),
    ]);
    renderCustomTypes(collectionTypes);
    if (schedules.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const title = document.createElement("p");
      title.className = "empty-state__title";
      title.textContent = t("schedules.no_schedules");
      const detail = document.createElement("p");
      detail.textContent = t("schedules.get_started");
      empty.append(title, detail, makeButton(t("schedules.add_schedule"), "text-button", () => openScheduleForm()));
      list.append(empty);
      return;
    }
    schedules.forEach((schedule) => list.append(renderScheduleCard(schedule)));
  } catch (error) {
    list.textContent = t("status.restart");
    console.error("Unable to load schedules", error);
  }
}

function renderCustomTypes(collectionTypes) {
  const list = document.querySelector("#custom-type-list");
  list.replaceChildren();
  const customTypes = collectionTypes.filter((type) => type.key?.kind === "custom");
  if (customTypes.length === 0) {
    list.textContent = t("schedules.custom_empty");
    return;
  }
  customTypes.forEach((type) => {
    const row = document.createElement("div");
    row.className = "custom-type-row";
    row.append(collectionIcon(type), document.createTextNode(collectionLabel(type)));
    row.append(makeButton(t("schedules.remove"), "text-button", () => deleteCustomType(type)));
    list.append(row);
  });
}

async function deleteCustomType(type) {
  if (!window.confirm(t("schedules.delete_confirm", { types: collectionLabel(type) }))) return;
  try {
    await invoke("delete_custom_collection_type", { id: type.id });
    await reconcileNativeNotifications();
    await loadSchedules();
    await loadHomeSummary();
  } catch (error) {
    window.alert(localizedError(error));
  }
}

function renderScheduleCard(schedule) {
  const card = document.createElement("article");
  card.className = "schedule-card";
  const info = document.createElement("div");
  const title = document.createElement("h2");
  title.append(
    collectionIconList(schedule.collectionTypes, "collection-icon-list collection-icon-list--schedule"),
    document.createTextNode(schedule.collectionTypes.map(collectionLabel).join(", ")),
  );
  const description = document.createElement("p");
  description.textContent = recurrenceLabel(schedule.rule);
  info.append(title, description);
  const actions = document.createElement("div");
  actions.className = "schedule-actions";
  actions.append(
    makeButton(t("schedules.edit"), "text-button", () => openScheduleForm(schedule.id)),
    makeButton(t("schedules.remove"), "text-button", () => deleteSchedule(schedule)),
  );
  card.append(info, actions);
  return card;
}

function formatShortDate(isoDate) {
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(localDateFromIso(isoDate));
}

function formatMonth(isoDate) {
  return new Intl.DateTimeFormat(getLocale(), {
    month: "long",
    year: "numeric",
  }).format(localDateFromIso(isoDate));
}

function calendarDayTitle(day, today) {
  if (day.date === today) return t("home.today");
  const tomorrow = new Date(localDateFromIso(today));
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, "0"), String(tomorrow.getDate()).padStart(2, "0")].join("-");
  return day.date === tomorrowIso ? t("home.tomorrow") : new Intl.DateTimeFormat(getLocale(), { weekday: "long" }).format(localDateFromIso(day.date));
}

async function loadCalendar(period = document.querySelector(".calendar-tab.is-active")?.dataset.calendarPeriod || "next_seven_days") {
  window.scrollTo(0, 0);
  const content = document.querySelector("#calendar-content");
  content.replaceChildren();
  try {
    const calendar = await invoke("get_calendar_period", { period });
    document.querySelectorAll(".calendar-tab").forEach((tab) => {
      const active = tab.dataset.calendarPeriod === period;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    if (period === "next_seven_days") {
      renderWeekCalendar(calendar, content);
    } else {
      renderMonthCalendar(calendar, content);
    }
  } catch (error) {
    content.textContent = t("status.calendar_restart");
    console.error("Unable to load calendar", error);
  }
}

function renderWeekCalendar(calendar, content) {
  const header = document.createElement("div");
  header.className = "calendar-range-heading";
  const title = document.createElement("h2");
  title.textContent = t("calendar.next_seven_days");
  const range = document.createElement("p");
  range.textContent = `${formatShortDate(calendar.startDate)} – ${formatShortDate(calendar.endDate)}`;
  header.append(title, range);
  const list = document.createElement("div");
  list.className = "calendar-day-list";
  calendar.days.forEach((day) => {
    const card = document.createElement("article");
    card.className = "calendar-day-card";
    if (day.date === calendar.today) card.classList.add("calendar-day-card--today");
    const number = document.createElement("div");
    number.className = "calendar-date-badge";
    number.innerHTML = `<span>${new Intl.DateTimeFormat(getLocale(), { weekday: "short" }).format(localDateFromIso(day.date))}</span><strong>${localDateFromIso(day.date).getDate()}</strong>`;
    const details = document.createElement("div");
    const label = document.createElement("h3");
    label.textContent = calendarDayTitle(day, calendar.today);
    const date = document.createElement("p");
    date.className = "calendar-day-date";
    date.textContent = formatDate(day.date);
    const collections = document.createElement("div");
    collections.className = "calendar-collections";
    if (day.collections.length) {
      collections.append(collectionChips(day.collections, "collection-chips collection-chips--calendar"));
    } else {
      collections.textContent = t("calendar.no_collection");
    }
    details.append(label, date, collections);
    card.append(number, details);
    list.append(card);
  });
  content.append(header, list);
}

function renderMonthCalendar(calendar, content) {
  const heading = document.createElement("div");
  heading.className = "calendar-month-heading";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow-text";
  eyebrow.textContent = calendar.startDate.slice(0, 7) === calendar.today.slice(0, 7) ? t("calendar.this_month") : t("calendar.next_month");
  const title = document.createElement("h2");
  title.textContent = formatMonth(calendar.startDate);
  heading.append(eyebrow, title);
  const weekdayLabels = document.createElement("div");
  weekdayLabels.className = "month-weekdays";
  shortWeekdayLabels().forEach((label) => {
    const item = document.createElement("span");
    item.textContent = label;
    weekdayLabels.append(item);
  });
  const grid = document.createElement("div");
  grid.className = "month-grid";
  const firstWeekday = localDateFromIso(calendar.startDate).getDay();
  for (let index = 0; index < firstWeekday; index += 1) {
    const blank = document.createElement("span");
    blank.setAttribute("aria-hidden", "true");
    grid.append(blank);
  }
  const details = document.createElement("div");
  details.className = "calendar-selection";
  let selectedButton;
  const selectDay = (day, button) => {
    selectedButton?.classList.remove("month-day--selected");
    selectedButton = button;
    selectedButton.classList.add("month-day--selected");
    details.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = formatDate(day.date);
    if (day.collections.length) {
      details.append(title, collectionChips(day.collections));
    } else {
      const description = document.createElement("p");
      description.textContent = t("calendar.no_collection_scheduled");
      details.append(title, description);
    }
  };
  calendar.days.forEach((day) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "month-day";
    if (day.date === calendar.today) button.classList.add("month-day--today");
    const number = document.createElement("span");
    number.textContent = String(localDateFromIso(day.date).getDate());
    button.append(number);
    if (day.collections.length) {
      const icons = document.createElement("span");
      icons.className = "month-day-icons";
      day.collections.forEach((collection) => icons.append(collectionIcon(collection)));
      button.append(icons);
    }
    button.setAttribute("aria-label", `${formatDate(day.date)}: ${day.collections.length ? day.collections.map(collectionLabel).join(", ") : t("calendar.no_collection")}`);
    button.addEventListener("click", () => selectDay(day, button));
    grid.append(button);
    if (day.date === calendar.today || (!selectedButton && day.date === calendar.startDate)) {
      selectDay(day, button);
    }
  });
  content.append(heading, weekdayLabels, grid, details);
}

function selectedReminderTime(kind) {
  const value = document.querySelector(`input[name="${kind}-time"]:checked`).value;
  return value === "custom" ? document.querySelector(`#${kind}-custom-time`).value : value;
}

function updateReminderCard(kind) {
  const enabled = document.querySelector(`#${kind}-enabled`).checked;
  const card = document.querySelector(`#${kind}-reminder`);
  const choices = document.querySelector(`#${kind}-times`);
  const customInput = document.querySelector(`#${kind}-custom-time`);
  const customButton = document.querySelector(`[data-time-input="${kind}-custom-time"]`);
  customButton.textContent = customInput.value ? `~${customInput.value}` : t("notifications.select");
  card.classList.toggle("notification-card--disabled", !enabled);
  choices.classList.toggle("is-hidden", !enabled);
  choices.querySelectorAll("input").forEach((input) => { input.disabled = !enabled; });
}

function setNotificationStatus(message = "", state = "") {
  const status = document.querySelector("#notification-status");
  status.textContent = message;
  status.className = `form-status${message ? "" : " is-hidden"}${state ? ` form-status--${state}` : ""}`;
}

async function loadNotificationSettings() {
  setNotificationStatus();
  try {
    const settings = await invoke("get_notification_settings");
    ["day-before", "day-of"].forEach((kind) => {
      const setting = kind === "day-before" ? settings.dayBefore : settings.dayOf;
      document.querySelector(`#${kind}-enabled`).checked = setting.enabled;
      const preset = document.querySelector(`input[name="${kind}-time"][value="${setting.time}"]`);
      if (preset) {
        preset.checked = true;
      } else {
        document.querySelector(`input[name="${kind}-time"][value="custom"]`).checked = true;
        document.querySelector(`#${kind}-custom-time`).value = setting.time;
      }
      updateReminderCard(kind);
    });
  } catch (error) {
    setNotificationStatus(t("status.settings_restart"), "error");
    console.error("Unable to load notification settings", error);
  }
}

async function saveNotificationSettings(event) {
  event.preventDefault();
  setNotificationStatus();
  const selectedTime = (kind) => selectedReminderTime(kind);
  const settings = {
    dayBefore: {
      enabled: document.querySelector("#day-before-enabled").checked,
      time: selectedTime("day-before"),
    },
    dayOf: {
      enabled: document.querySelector("#day-of-enabled").checked,
      time: selectedTime("day-of"),
    },
  };
  try {
    await invoke("save_notification_settings", { settings });
    const result = await reconcileNativeNotifications({
      requestPermission: settings.dayBefore.enabled || settings.dayOf.enabled,
    });
    if (result.permission === "denied") {
      setNotificationStatus(t("notifications.permission_denied"), "error");
    } else if (result.permission === "unavailable") {
      setNotificationStatus(t("notifications.unavailable"), "error");
    } else if (result.permission === "not-needed") {
      setNotificationStatus(t("notifications.saved_off"), "success");
    } else {
      setNotificationStatus(t("notifications.saved"), "success");
    }
  } catch (error) {
    setNotificationStatus(localizedError(error), "error");
  }
}

async function deleteSchedule(schedule) {
  const types = schedule.collectionTypes.map(collectionLabel).join(", ");
  if (!window.confirm(t("schedules.delete_confirm", { types }))) return;
  try {
    await invoke("delete_schedule", { id: schedule.id });
    await reconcileNativeNotifications();
    await loadSchedules();
  } catch (error) {
    window.alert(localizedError(error));
  }
}

function inputLabel({ name, value, label, checked = false, collection = null }) {
  const wrapper = document.createElement("label");
  wrapper.className = "check-option";
  if (collection) {
    const presentation = presentationFor(collection);
    wrapper.classList.add("check-option--collection");
    wrapper.style.setProperty("--type-color", presentation.color);
    wrapper.style.setProperty("--type-tint", presentation.tint);
  }
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.value = value;
  input.checked = checked;
  const text = document.createElement("span");
  text.textContent = label;
  if (collection) wrapper.append(input, collectionIcon(collection), text);
  else wrapper.append(input, text);
  return wrapper;
}

function selectedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function setFormError(message = "") {
  const error = document.querySelector("#form-error");
  error.textContent = message;
  error.classList.toggle("is-hidden", !message);
}

function setRecurrenceMode(mode) {
  document.querySelector("#weekly-fields").classList.toggle("is-hidden", mode !== "weekly");
  document.querySelector("#monthly-fields").classList.toggle("is-hidden", mode !== "monthly");
}

async function loadSettings() {
  const selected = await invoke("get_locale");
  const effective = selected === "japanese" ? "ja" : selected === "english" ? "en" : deviceLocale();
  document.querySelector(`input[name="language"][value="${effective}"]`).checked = true;
  setText("#device-language", t("settings.device_language_hint", { language: languageName(effective) }));
}

async function saveLocale(event) {
  const locale = event.target.value;
  try {
    await invoke("save_locale", { locale: locale === "ja" ? "japanese" : "english" });
    setLocale(locale);
    translateDocument();
    await loadSettings();
    if (activePrimaryView === "home") await loadHomeSummary();
    if (activePrimaryView === "calendar") await loadCalendar();
    if (activePrimaryView === "schedules") {
      if (!document.querySelector("#schedule-form-view").classList.contains("is-hidden")) {
        await openScheduleForm(editingScheduleId);
      } else {
        await loadSchedules();
      }
    }
    if (activePrimaryView === "notifications") await loadNotificationSettings();
    await reconcileNativeNotifications();
  } catch (error) {
    window.alert(localizedError(error));
  }
}

async function openScheduleForm(id = null) {
  editingScheduleId = id;
  setFormError();
  const [collectionTypes, schedule] = await Promise.all([
    invoke("list_collection_types"),
    id ? invoke("get_schedule", { id }) : Promise.resolve(null),
  ]);
  const selectedTypes = new Set(schedule?.collectionTypeIds || []);
  const collectionOptions = document.querySelector("#collection-type-options");
  collectionOptions.replaceChildren(...collectionTypes.map((type) => inputLabel({
    name: "collection-type",
    value: type.id,
    label: collectionLabel(type),
    checked: selectedTypes.has(type.id),
    collection: type,
  })));
  const customType = collectionTypes.find((type) =>
    type.key?.kind === "custom" && selectedTypes.has(type.id));
  document.querySelector("#custom-collection-type").value = customType ? collectionLabel(customType) : "";

  const weeklyValues = new Set(schedule?.rule?.kind === "weekly" ? schedule.rule.weekdays : []);
  const weekdayOptions = document.querySelector("#weekday-options");
  weekdayOptions.replaceChildren(...weekdays.map(([value, label]) => inputLabel({
    name: "weekday",
    value,
    label: t(label),
    checked: weeklyValues.has(value),
  })));

  const monthlyWeekday = document.querySelector("#monthly-weekday");
  monthlyWeekday.replaceChildren(new Option(t("form.choose_day"), ""));
  weekdays.forEach(([value, label]) => monthlyWeekday.add(new Option(t(label), value)));
  const monthlyRule = schedule?.rule?.kind === "monthly_nth_weekday" ? schedule.rule : null;
  monthlyWeekday.value = monthlyRule?.weekday || "";
  const selectedOrdinals = new Set(monthlyRule?.ordinals?.map(String) || []);
  const ordinalOptions = document.querySelector("#ordinal-options");
  ordinalOptions.replaceChildren(...[1, 2, 3, 4, 5].map((ordinal) => inputLabel({
    name: "ordinal",
    value: String(ordinal),
    label: t(`recurrence.ordinal_${ordinal}`),
    checked: selectedOrdinals.has(String(ordinal)),
  })));

  const isMonthly = Boolean(monthlyRule);
  document.querySelector(`input[name="recurrence"][value="${isMonthly ? "monthly" : "weekly"}"]`).checked = true;
  setRecurrenceMode(isMonthly ? "monthly" : "weekly");
  setText("#schedule-form-mode", t(id ? "form.update_routine" : "form.new_routine"));
  setText("#schedule-form-heading", t(id ? "form.edit_schedule" : "form.add_schedule"));
  setText("#save-schedule", t(id ? "form.save_changes" : "form.save_schedule"));
  showView("schedule-form");
}

async function saveSchedule(event) {
  event.preventDefault();
  setFormError();
  const mode = document.querySelector('input[name="recurrence"]:checked').value;
  const input = {
    collectionTypeIds: selectedValues("collection-type"),
    rule: mode === "weekly"
      ? { kind: "weekly", weekdays: selectedValues("weekday") }
      : {
          kind: "monthly_nth_weekday",
          weekday: document.querySelector("#monthly-weekday").value,
          ordinals: selectedValues("ordinal").map(Number),
        },
  };
  try {
    const customName = document.querySelector("#custom-collection-type").value.trim();
    if (customName) {
      const customType = await invoke("create_custom_collection_type", { name: customName });
      input.collectionTypeIds.push(customType.id);
    }
    if (editingScheduleId) {
      await invoke("update_schedule", { id: editingScheduleId, input });
    } else {
      await invoke("create_schedule", { input });
    }
    await reconcileNativeNotifications();
    showView("schedules");
  } catch (error) {
    setFormError(localizedError(error));
  }
}

async function initializeLocale() {
  const selected = await invoke("get_locale");
  setLocale(selected === "japanese" ? "ja" : selected === "english" ? "en" : deviceLocale());
  translateDocument();
}

window.addEventListener("DOMContentLoaded", async () => {
  await initializeLocale();
  document.querySelector("#brand-mark").src = brandMark;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  installPrimaryViewSwipeNavigation();
  document.querySelectorAll("[data-calendar-period]").forEach((button) => {
    button.addEventListener("click", () => loadCalendar(button.dataset.calendarPeriod));
  });
  document.querySelector("#add-schedule").addEventListener("click", () => openScheduleForm());
  document.querySelector("#schedule-form").addEventListener("submit", saveSchedule);
  document.querySelector("#notification-settings-form").addEventListener("submit", saveNotificationSettings);
  document.querySelectorAll('input[name="language"]').forEach((input) => input.addEventListener("change", saveLocale));
  ["day-before", "day-of"].forEach((kind) => {
    document.querySelector(`#${kind}-enabled`).addEventListener("change", () => updateReminderCard(kind));
    document.querySelectorAll(`input[name="${kind}-time"], #${kind}-custom-time`).forEach((input) => {
      const updateTimeSelection = () => {
        if (input.id === `${kind}-custom-time`) {
          if (!input.value) {
            input.value = defaultReminderTimes[kind];
            document.querySelector(`input[name="${kind}-time"][value="${input.value}"]`).checked = true;
          } else {
            document.querySelector(`input[name="${kind}-time"][value="custom"]`).checked = true;
          }
        }
        updateReminderCard(kind);
      };
      input.addEventListener("change", updateTimeSelection);
      input.addEventListener("input", updateTimeSelection);
    });
  });
  document.querySelectorAll(".custom-time-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const input = document.querySelector(`#${button.dataset.timeInput}`);
      input.showPicker?.();
      input.focus();
    });
  });
  document.querySelectorAll('input[name="recurrence"]').forEach((input) => {
    input.addEventListener("change", () => setRecurrenceMode(input.value));
  });
  loadHomeSummary();
  // This never prompts on launch; it only refreshes reminders after a prior grant.
  reconcileNativeNotifications();
});
