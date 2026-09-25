const { invoke } = window.__TAURI__.core;

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

function renderDay(day, prefix) {
  document.querySelector(`#${prefix}-date`).textContent = formatDate(day.date);
  const content = document.querySelector(`#${prefix}-content`);
  content.replaceChildren();

  if (day.collections.length === 0) {
    const title = document.createElement("p");
    title.className = "collection-title collection-title--empty";
    title.textContent = "No collection scheduled";
    const detail = document.createElement("p");
    detail.className = "collection-detail";
    detail.textContent =
      prefix === "today"
        ? "Enjoy a rubbish-free day."
        : "There is nothing to put out yet.";
    content.append(title, detail);
    return;
  }

  const title = document.createElement("p");
  title.className = "collection-title";
  title.textContent = day.collections.map((collection) => collection.name).join(", ");
  const detail = document.createElement("p");
  detail.className = "collection-detail";
  detail.textContent =
    prefix === "today"
      ? "Put these out for collection today."
      : "Get these ready tonight.";
  content.append(title, detail);
}

async function loadHomeSummary() {
  try {
    const summary = await invoke("get_home_summary");
    renderDay(summary.today, "today");
    renderDay(summary.tomorrow, "tomorrow");
  } catch (error) {
    for (const prefix of ["today", "tomorrow"]) {
      document.querySelector(`#${prefix}-date`).textContent = "Schedule unavailable";
      const content = document.querySelector(`#${prefix}-content`);
      content.replaceChildren();
      const detail = document.createElement("p");
      detail.className = "collection-detail";
      detail.textContent = "Unable to load your local schedule. Please restart TrashTalk.";
      content.append(detail);
    }
    console.error("Unable to load the Home summary", error);
  }
}

window.addEventListener("DOMContentLoaded", loadHomeSummary);
