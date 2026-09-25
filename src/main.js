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
  if (name === "home") loadHomeSummary();
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
