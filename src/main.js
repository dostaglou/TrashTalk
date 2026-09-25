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

let editingScheduleId = null;

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
    title.textContent = day.collections.map((collection) => collection.name).join(", ");
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
  document.querySelectorAll(".view").forEach((view) => view.classList.add("is-hidden"));
  document.querySelector(`#${name}-view`).classList.remove("is-hidden");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("nav-link--active", button.dataset.view === name);
  });
  document.querySelectorAll("[data-calendar-period]").forEach((button) => {
    button.addEventListener("click", () => loadCalendar(button.dataset.calendarPeriod));
  });
  if (name === "home") loadHomeSummary();
  if (name === "calendar") loadCalendar();
  if (name === "schedules") loadSchedules();
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
  title.textContent = schedule.collectionTypes.map((collection) => collection.name).join(", ");
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
    const collections = document.createElement("p");
    collections.className = "calendar-collections";
    collections.textContent = day.collections.length ? day.collections.map((item) => item.name).join(", ") : "No collection";
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
    const description = document.createElement("p");
    description.textContent = day.collections.length ? day.collections.map((item) => item.name).join(", ") : "No collection scheduled";
    details.append(title, description);
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
      const count = document.createElement("small");
      count.textContent = day.collections.length === 1 ? "1 item" : `${day.collections.length} items`;
      button.append(count);
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

async function deleteSchedule(schedule) {
  const types = schedule.collectionTypes.map((item) => item.name).join(", ");
  if (!window.confirm(`Delete the ${types} schedule?`)) return;
  try {
    await invoke("delete_schedule", { id: schedule.id });
    await loadSchedules();
  } catch (error) {
    window.alert(error);
  }
}

function inputLabel({ name, value, label, checked = false }) {
  const wrapper = document.createElement("label");
  wrapper.className = "check-option";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.value = value;
  input.checked = checked;
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(input, text);
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
    showView("schedules");
  } catch (error) {
    setFormError(String(error));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  document.querySelector("#add-schedule").addEventListener("click", () => openScheduleForm());
  document.querySelector("#back-to-schedules").addEventListener("click", () => showView("schedules"));
  document.querySelector("#schedule-form").addEventListener("submit", saveSchedule);
  document.querySelectorAll('input[name="recurrence"]').forEach((input) => {
    input.addEventListener("change", () => setRecurrenceMode(input.value));
  });
  loadHomeSummary();
});
