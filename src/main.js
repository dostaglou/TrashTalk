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
  ["sunday", "Sunday"],
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
];

const collectionPresentation = {
  "system.combustible": { icon: combustibleIcon, color: "#fb923c", tint: "#fff1e6" },
  "system.plastics": { icon: plasticsIcon, color: "#2dd4bf", tint: "#e4fbf6" },
  "system.pet-bottles": { icon: petBottleIcon, color: "#60a5fa", tint: "#eaf3ff" },
  "system.unburnables": { icon: unburnablesIcon, color: "#64748b", tint: "#edf1f5" },
  "system.glass": { icon: glassIcon, color: "#c084fc", tint: "#f4ebff" },
  "system.cans-and-spray-cans": { icon: canisterIcon, color: "#94a3b8", tint: "#f0f4f7" },
  "system.cardboard-newspapers-magazines": { icon: cardboardIcon, color: "#fbbf24", tint: "#fff6d9" },
  "system.small-electronics-household-appliances": { icon: appliancesIcon, color: "#f472b6", tint: "#ffebf5" },
  custom: { icon: customIcon, color: "#a78bfa", tint: "#f2edff" },
};

let editingScheduleId = null;
const primaryViews = ["home", "calendar", "schedules", "notifications"];
let activePrimaryView = "home";

const reminderChannel = {
  id: "trash-talk-reminders",
  name: "TrashTalk reminders",
  description: "Upcoming trash collection reminders",
  importance: Importance.Default,
  vibration: true,
};

function presentationFor(collection) {
  return collectionPresentation[collection.id] || collectionPresentation.custom;
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
    chip.append(collectionIcon(collection), document.createTextNode(collection.name));
    chips.append(chip);
  });
  return chips;
}

function localDateFromIso(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat(undefined, {
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
    title.textContent = "No collection scheduled";
    detail.textContent = prefix === "today" ? "Enjoy a rubbish-free day." : "There is nothing to put out yet.";
  } else {
    title.className = "collection-title";
    title.append(
      collectionIconList(day.collections, "collection-icon-list collection-icon-list--title"),
      document.createTextNode(day.collections.map((collection) => collection.name).join(", ")),
    );
    detail.textContent = prefix === "today" ? "Put these out for collection today." : "Get these ready tonight.";
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
      setText(`#${prefix}-date`, "Schedule unavailable");
      setText(`#${prefix}-content`, "Unable to load your local schedule. Please restart TrashTalk.");
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
    await createChannel(reminderChannel);
    const plan = await invoke("get_notification_plan");
    plan.forEach((notification) => {
      sendNotification({
        id: notification.id,
        channelId: reminderChannel.id,
        title: notification.title,
        body: notification.body,
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
    const schedules = await invoke("list_schedules");
    if (schedules.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const title = document.createElement("p");
      title.className = "empty-state__title";
      title.textContent = "No schedules yet";
      const detail = document.createElement("p");
      detail.textContent = "Add your first collection day to get started.";
      empty.append(title, detail, makeButton("Add a schedule", "text-button", () => openScheduleForm()));
      list.append(empty);
      return;
    }
    schedules.forEach((schedule) => list.append(renderScheduleCard(schedule)));
  } catch (error) {
    list.textContent = "Unable to load schedules. Please restart TrashTalk.";
    console.error("Unable to load schedules", error);
  }
}

function renderScheduleCard(schedule) {
  const card = document.createElement("article");
  card.className = "schedule-card";
  const info = document.createElement("div");
  const title = document.createElement("h2");
  title.append(
    collectionIconList(schedule.collectionTypes, "collection-icon-list collection-icon-list--schedule"),
    document.createTextNode(schedule.collectionTypes.map((collection) => collection.name).join(", ")),
  );
  const description = document.createElement("p");
  description.textContent = schedule.recurrenceDescription;
  info.append(title, description);
  const actions = document.createElement("div");
  actions.className = "schedule-actions";
  actions.append(
    makeButton("Edit", "text-button", () => openScheduleForm(schedule.id)),
    makeButton("Delete", "text-button", () => deleteSchedule(schedule)),
  );
  card.append(info, actions);
  return card;
}

function formatShortDate(isoDate) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(localDateFromIso(isoDate));
}

function formatMonth(isoDate) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(localDateFromIso(isoDate));
}

function calendarDayTitle(day, today) {
  if (day.date === today) return "Today";
  const tomorrow = new Date(localDateFromIso(today));
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, "0"), String(tomorrow.getDate()).padStart(2, "0")].join("-");
  return day.date === tomorrowIso ? "Tomorrow" : new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(localDateFromIso(day.date));
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
    content.textContent = "Unable to load the calendar. Please restart TrashTalk.";
    console.error("Unable to load calendar", error);
  }
}

function renderWeekCalendar(calendar, content) {
  const header = document.createElement("div");
  header.className = "calendar-range-heading";
  const title = document.createElement("h2");
  title.textContent = "Next 7 days";
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
    number.innerHTML = `<span>${new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(localDateFromIso(day.date))}</span><strong>${localDateFromIso(day.date).getDate()}</strong>`;
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
      collections.textContent = "No collection";
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
  eyebrow.textContent = calendar.startDate.slice(0, 7) === calendar.today.slice(0, 7) ? "This month" : "Next month";
  const title = document.createElement("h2");
  title.textContent = formatMonth(calendar.startDate);
  heading.append(eyebrow, title);
  const weekdayLabels = document.createElement("div");
  weekdayLabels.className = "month-weekdays";
  ["S", "M", "T", "W", "T", "F", "S"].forEach((label) => {
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
      description.textContent = "No collection scheduled";
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
    button.setAttribute("aria-label", `${formatDate(day.date)}: ${day.collections.length ? day.collections.map((item) => item.name).join(", ") : "No collection"}`);
    button.addEventListener("click", () => selectDay(day, button));
    grid.append(button);
    if (day.date === calendar.today || (!selectedButton && day.date === calendar.startDate)) {
      selectDay(day, button);
    }
  });
  content.append(heading, weekdayLabels, grid, details);
}

function updateReminderCard(kind) {
  const enabled = document.querySelector(`#${kind}-enabled`).checked;
  const card = document.querySelector(`#${kind}-reminder`);
  const choices = document.querySelector(`#${kind}-times`);
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
      document.querySelector(`input[name="${kind}-time"][value="${setting.time}"]`).checked = true;
      updateReminderCard(kind);
    });
  } catch (error) {
    setNotificationStatus("Unable to load notification settings. Please restart TrashTalk.", "error");
    console.error("Unable to load notification settings", error);
  }
}

async function saveNotificationSettings(event) {
  event.preventDefault();
  setNotificationStatus();
  const settings = {
    dayBefore: {
      enabled: document.querySelector("#day-before-enabled").checked,
      time: document.querySelector('input[name="day-before-time"]:checked').value,
    },
    dayOf: {
      enabled: document.querySelector("#day-of-enabled").checked,
      time: document.querySelector('input[name="day-of-time"]:checked').value,
    },
  };
  try {
    await invoke("save_notification_settings", { settings });
    const result = await reconcileNativeNotifications({
      requestPermission: settings.dayBefore.enabled || settings.dayOf.enabled,
    });
    if (result.permission === "denied") {
      setNotificationStatus("Settings saved. Android notification permission was not granted, so reminders are not scheduled.", "error");
    } else if (result.permission === "unavailable") {
      setNotificationStatus("Settings saved, but Android reminders could not be scheduled on this device.", "error");
    } else if (result.permission === "not-needed") {
      setNotificationStatus("Settings saved. Reminders are off.", "success");
    } else {
      setNotificationStatus(`Settings saved.`, "success");
    }
  } catch (error) {
    setNotificationStatus(String(error), "error");
  }
}

async function deleteSchedule(schedule) {
  const types = schedule.collectionTypes.map((item) => item.name).join(", ");
  if (!window.confirm(`Delete the ${types} schedule?`)) return;
  try {
    await invoke("delete_schedule", { id: schedule.id });
    await reconcileNativeNotifications();
    await loadSchedules();
  } catch (error) {
    window.alert(error);
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
    label: type.name,
    checked: selectedTypes.has(type.id),
    collection: type,
  })));

  const weeklyValues = new Set(schedule?.rule?.kind === "weekly" ? schedule.rule.weekdays : []);
  const weekdayOptions = document.querySelector("#weekday-options");
  weekdayOptions.replaceChildren(...weekdays.map(([value, label]) => inputLabel({
    name: "weekday",
    value,
    label,
    checked: weeklyValues.has(value),
  })));

  const monthlyWeekday = document.querySelector("#monthly-weekday");
  monthlyWeekday.replaceChildren(new Option("Choose a day", ""));
  weekdays.forEach(([value, label]) => monthlyWeekday.add(new Option(label, value)));
  const monthlyRule = schedule?.rule?.kind === "monthly_nth_weekday" ? schedule.rule : null;
  monthlyWeekday.value = monthlyRule?.weekday || "";
  const selectedOrdinals = new Set(monthlyRule?.ordinals?.map(String) || []);
  const ordinalOptions = document.querySelector("#ordinal-options");
  ordinalOptions.replaceChildren(...[1, 2, 3, 4, 5].map((ordinal) => inputLabel({
    name: "ordinal",
    value: String(ordinal),
    label: `${ordinal}${ordinal === 1 ? "st" : ordinal === 2 ? "nd" : ordinal === 3 ? "rd" : "th"}`,
    checked: selectedOrdinals.has(String(ordinal)),
  })));

  const isMonthly = Boolean(monthlyRule);
  document.querySelector(`input[name="recurrence"][value="${isMonthly ? "monthly" : "weekly"}"]`).checked = true;
  setRecurrenceMode(isMonthly ? "monthly" : "weekly");
  setText("#schedule-form-mode", id ? "Update routine" : "New routine");
  setText("#schedule-form-heading", id ? "Edit schedule" : "Add a schedule");
  setText("#save-schedule", id ? "Save changes" : "Add schedule");
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
    if (editingScheduleId) {
      await invoke("update_schedule", { id: editingScheduleId, input });
    } else {
      await invoke("create_schedule", { input });
    }
    await reconcileNativeNotifications();
    showView("schedules");
  } catch (error) {
    setFormError(String(error));
  }
}

window.addEventListener("DOMContentLoaded", () => {
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
  ["day-before", "day-of"].forEach((kind) => {
    document.querySelector(`#${kind}-enabled`).addEventListener("change", () => updateReminderCard(kind));
  });
  document.querySelectorAll('input[name="recurrence"]').forEach((input) => {
    input.addEventListener("change", () => setRecurrenceMode(input.value));
  });
  loadHomeSummary();
  // This never prompts on launch; it only refreshes reminders after a prior grant.
  reconcileNativeNotifications();
});
