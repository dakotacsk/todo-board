import {
  initial,
  statuses,
  colors,
  dateKey,
  transition,
  totals,
  validate,
  dueInfo,
  moveTask,
} from "./model.js";
const KEY = "daymark.data.v1";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let data = initial(),
  view = "board",
  category = "",
  query = "",
  layout = "board",
  selectedDate = dateKey(new Date()),
  month = dateKey(new Date()).slice(0, 7),
  storageError = "";
try {
  const saved = localStorage.getItem(KEY);
  if (saved) data = validate(JSON.parse(saved));
} catch {
  storageError =
    "Saved data could not be read. Export the stored copy in Settings before replacing it.";
}
const icons = ["◌", "○", "◔", "●"];
let toastTimer;
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    toast("Could not save. Export a backup now; browser storage may be full.");
    return false;
  }
}
function commit(next) {
  if (storageError) {
    toast(storageError);
    return false;
  }
  const before = data;
  data = next;
  if (!save()) {
    data = before;
    return false;
  }
  return true;
}
function unlock() {
  render();
}
function lock() {
  sessionStorage.removeItem("daymark.unlocked");
  renderLock();
}
function renderLock() {
  document.title = "Daymark · Locked";
  $("#app").innerHTML =
    `<main class="lock"><div class="lock-box"><div class="brand"><span class="mark">d</span>daymark</div><h1>A little space for<br>getting things done.</h1><p>Your tasks, at your pace.</p><form id="unlock"><label>Password<input id="password" type="password" autocomplete="current-password" required autofocus></label><div class="error" id="lock-error" role="alert"></div><button class="primary">Open my workspace →</button></form><small>Personal workspace · Dakota Chang</small></div></main>`;
  $("#unlock").onsubmit = (e) => {
    e.preventDefault();
    if (
      $("#password").value ===
      (localStorage.getItem("daymark.password") || "little-steps")
    ) {
      sessionStorage.setItem("daymark.unlocked", "yes");
      unlock();
    } else
      $("#lock-error").textContent = "That password doesn’t match. Try again.";
  };
}
function getCategory(id) {
  return data.categories.find((c) => c.id === id);
}
function taskCard(t, index, group) {
  const c = getCategory(t.category);
  const due = dueInfo(t);
  return `<article class="card" draggable="true" data-task="${esc(t.id)}" style="--cat:${c?.color || "#99958b"}"><button class="card-open" draggable="true" data-edit="${esc(t.id)}" aria-label="Edit ${esc(t.title)}"><div class="card-id">DM-${esc(t.number)}${t.priority === "High" ? " · High priority" : ""}</div><div class="card-title">${esc(t.title)}</div><div class="card-footer">${c ? `<span class="tag">${esc(c.name)}</span>` : "<span>Uncategorized</span>"}<span class="points">${t.points} pts</span></div>${due ? `<span class="due-date ${due.overdue ? "overdue" : ""}">${esc(due.label)}</span>` : ""}</button><div class="reorder"><button data-move="up" aria-label="Move ${esc(t.title)} up" ${index === 0 ? "disabled" : ""}>↑</button><button data-move="down" aria-label="Move ${esc(t.title)} down" ${index === group.length - 1 ? "disabled" : ""}>↓</button></div></article>`;
}
function render() {
  document.title =
    "Daymark · " + (view === "activity" ? "Activity" : "My board");
  const today = totals(data.tasks, dateKey(new Date()));
  const cats = data.categories
    .map(
      (c) =>
        `<button class="navitem ${category === c.id && view === "board" ? "active" : ""}" data-category="${esc(c.id)}"><span class="dot" style="--cat:${c.color}"></span>${esc(c.name)}<span class="count">${data.tasks.filter((t) => t.category === c.id && t.status !== "Done").length}</span></button>`,
    )
    .join("");
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><div><div class="brand"><span class="mark">d</span>daymark</div><div class="workspace">Dakota’s workspace</div></div><nav><button class="navitem ${view === "board" && !category ? "active" : ""}" data-view="board">▦ <span>All tasks</span><span class="count">${data.tasks.filter((t) => t.status !== "Done").length}</span></button><button class="navitem ${view === "activity" ? "active" : ""}" data-view="activity">↗ <span>Activity</span></button></nav><section><div class="section-label"><span class="eyebrow">Categories</span><button id="manage-categories" aria-label="Manage categories">+</button></div><nav>${cats}</nav></section><div class="bottom"><button id="export">↗ &nbsp; Export backup</button><button id="settings">⚙ &nbsp; Settings</button><button id="lock">↪ &nbsp; Lock workspace</button><div class="local"><span>●</span> &nbsp; Saved in this browser</div></div></aside><main class="main"><header class="topbar"><div class="crumb"><button class="mobile-menu" aria-label="Toggle menu">☰</button>My workspace &nbsp; / &nbsp; <b>${view === "activity" ? "Activity" : "Tasks"}</b></div><div class="topright"><span>${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><button class="primary" id="new-task">+ New task <kbd>C</kbd></button></div></header><div class="content">${storageError ? `<p class="error">${esc(storageError)}</p>` : ""}${view === "activity" ? activityHTML() : `<div class="heading"><div><h1>${esc(getCategory(category)?.name || "My board")}</h1><p>A little progress, every day.</p></div><div class="today"><div><strong>${today.points}<span class="unit"> pts</span></strong><small>COMPLETED TODAY</small></div><div><strong>${today.tickets}</strong><small>TASKS DONE</small></div></div></div><div class="toolbar"><input class="search" type="search" placeholder="Search tasks…" aria-label="Search tasks" value="${esc(query)}"><div class="switch"><button data-layout="board" class="${layout === "board" ? "active" : ""}">▦ Board</button><button data-layout="list" class="${layout === "list" ? "active" : ""}">☰ List</button></div></div><div id="tasks"></div>`}</div></main></div>`;
  $("#new-task").onclick = () => editTask();
  $("#manage-categories").onclick = manageCategories;
  $("#export").onclick = exportData;
  $("#settings").onclick = settings;
  $("#lock").onclick = lock;
  $(".mobile-menu").onclick = () => $(".sidebar").classList.toggle("open");
  document.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        category = "";
        query = "";
        render();
      }),
  );
  document.querySelectorAll("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        view = "board";
        category = b.dataset.category;
        render();
      }),
  );
  if (view === "board") {
    $(".search").oninput = (e) => {
      query = e.target.value;
      renderTasks();
    };
    document.querySelectorAll("[data-layout]").forEach(
      (b) =>
        (b.onclick = () => {
          layout = b.dataset.layout;
          render();
        }),
    );
    renderTasks();
  } else {
    $("#month").onchange = (e) => {
      if (e.target.value) {
        month = e.target.value;
        render();
      }
    };
    $("#day").onchange = (e) => {
      if (e.target.value) {
        selectedDate = e.target.value;
        render();
      }
    };
    document.querySelectorAll("[data-chart-label]").forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.chartLabel.includes("-")) {
            selectedDate = b.dataset.chartLabel;
            render();
          }
          toast(b.title);
        }),
    );
  }
}
function renderTasks() {
  const tasks = data.tasks.filter(
    (t) =>
      (!category || t.category === category) &&
      `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  $("#tasks").className = layout;
  $("#tasks").innerHTML = statuses
    .map((s, i) => {
      const group = tasks.filter((t) => t.status === s);
      return `<section class="column" data-status="${s}"><div class="column-head"><span class="status-icon status-${i}">${icons[i]}</span>${s}<span class="num">${group.length}</span><button data-add="${s}" aria-label="Add task to ${s}">+</button></div>${group.map(taskCard).join("") || '<div class="empty">' + (query ? "No matching tasks" : "Room for your next step.") + "</div>"}<button class="add-card" data-add="${s}">+ Add task</button></section>`;
    })
    .join("");
  document
    .querySelectorAll("[data-add]")
    .forEach((b) => (b.onclick = () => editTask(null, b.dataset.add)));
  document.querySelectorAll("[data-task]").forEach((b) => {
    b.querySelector("[data-edit]").onclick = () => editTask(b.dataset.task);
    b.querySelectorAll("[data-move]").forEach(
      (control) =>
        (control.onclick = () => {
          const task = data.tasks.find((t) => t.id === b.dataset.task);
          const group = tasks.filter((t) => t.status === task.status);
          const index = group.findIndex((t) => t.id === task.id);
          const down = control.dataset.move === "down";
          const target = group[index + (down ? 1 : -1)];
          if (
            target &&
            commit({
              ...data,
              tasks: moveTask(
                data.tasks,
                task.id,
                task.status,
                target.id,
                down,
              ),
            })
          ) {
            render();
            const moved = [...document.querySelectorAll("[data-task]")].find(
              (el) => el.dataset.task === task.id,
            );
            moved?.querySelector("[data-edit]")?.focus();
            toast("Task moved " + (down ? "down" : "up"));
          }
        }),
    );
    b.ondragover = (e) => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.add("drop-before");
    };
    b.ondragleave = () => b.classList.remove("drop-before");
    b.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = data.tasks.find((t) => t.id === b.dataset.task);
      if (
        commit({
          ...data,
          tasks: moveTask(
            data.tasks,
            e.dataTransfer.getData("text/plain"),
            target.status,
            target.id,
          ),
        })
      )
        render();
    };
    b.ondragstart = (e) => {
      e.dataTransfer.setData("text/plain", b.dataset.task);
      e.dataTransfer.effectAllowed = "move";
    };
  });
  document.querySelectorAll("[data-status]").forEach((col) => {
    col.ondragover = (e) => {
      e.preventDefault();
      col.classList.add("dragover");
    };
    col.ondragleave = () => col.classList.remove("dragover");
    col.ondrop = (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (
        commit({
          ...data,
          tasks: moveTask(data.tasks, id, col.dataset.status),
        })
      )
        render();
    };
  });
}
function modal(html) {
  $("#modal").innerHTML = html;
  $("#modal").showModal();
  $("#modal")
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => $("#modal").close()));
}
const options = (values, current) =>
  values
    .map((s) => `<option ${s === current ? "selected" : ""}>${esc(s)}</option>`)
    .join("");
function editTask(id, status = "Todo") {
  const old = data.tasks.find((t) => t.id === id);
  const t = old || {
    title: "",
    description: "",
    status,
    points: 1,
    category,
    priority: "None",
  };
  modal(
    `<form id="task-form"><div class="modal-head"><h2>${old ? "Edit task" : "New task"}</h2><button type="button" data-close aria-label="Close">×</button></div><div class="fields"><label>Title<input name="title" value="${esc(t.title)}" placeholder="What would you like to get done?" maxlength="200" required autofocus></label><label>Notes<textarea name="description" placeholder="A few details, if you need them…" maxlength="20000">${esc(t.description)}</textarea></label><div class="row"><label>Status<select name="status">${options(statuses, t.status)}</select></label><label>Category<select name="category"><option value="">Uncategorized</option>${data.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === t.category ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label></div><div class="row"><label>Points<input name="points" type="number" min="0" max="100" step="1" required value="${t.points}"></label><label>Priority<select name="priority">${options(["None", "Low", "Medium", "High"], t.priority)}</select></label></div><label>Due date<input name="dueDate" type="date" min="0001-01-01" max="9999-12-31" value="${esc(t.dueDate || "")}"></label>${old?.completedAt ? `<p class="help">Completed ${esc(new Date(old.completedAt).toLocaleString())}. Reopening removes this completion from Activity.</p>` : ""}</div><div class="actions">${old ? '<button type="button" class="danger" id="delete-task">Delete task</button>' : ""}<button type="button" data-close>Cancel</button><button class="primary">${old ? "Save changes" : "Create task"}</button></div></form>`,
  );
  $("#task-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!f.get("title").trim()) return;
    const base = {
      ...t,
      id: old?.id || crypto.randomUUID(),
      number:
        old?.number || Math.max(0, ...data.tasks.map((x) => x.number || 0)) + 1,
      title: f.get("title").trim(),
      description: f.get("description"),
      category: f.get("category"),
      points: Number(f.get("points")),
      priority: f.get("priority"),
      dueDate: f.get("dueDate") || "",
      createdAt: old?.createdAt || new Date().toISOString(),
    };
    const updated = transition(base, f.get("status"));
    if (
      commit({
        ...data,
        tasks: old
          ? data.tasks.map((x) => (x.id === id ? updated : x))
          : [...data.tasks, updated],
      })
    ) {
      $("#modal").close();
      render();
      toast(old ? "Task updated" : "Task created");
    }
  };
  if (old)
    $("#delete-task").onclick = () => {
      if (
        confirm("Delete this task? Its completion points will also be removed.")
      ) {
        if (commit({ ...data, tasks: data.tasks.filter((t) => t.id !== id) })) {
          $("#modal").close();
          render();
          toast("Task deleted");
        }
      }
    };
}
function manageCategories() {
  modal(
    `<div class="modal-head"><h2>Your categories</h2><button data-close aria-label="Close">×</button></div><p class="help">Give each part of your life its own color.</p><div id="category-fields">${data.categories.map((c) => `<div class="category-edit" data-id="${esc(c.id)}"><input type="color" aria-label="Category color" value="${c.color}"><input type="text" aria-label="Category name" maxlength="40" value="${esc(c.name)}"><button data-remove aria-label="Remove ${esc(c.name)}">×</button></div>`).join("")}</div><button id="add-category">+ Add category</button><p class="help">Removing a category keeps its tasks as Uncategorized.</p><div class="actions"><button data-close>Cancel</button><button id="save-categories" class="primary">Save categories</button></div>`,
  );
  const wire = () =>
    $("#category-fields")
      .querySelectorAll("[data-remove]")
      .forEach((b) => (b.onclick = () => b.closest(".category-edit").remove()));
  wire();
  $("#add-category").onclick = () => {
    $("#category-fields").insertAdjacentHTML(
      "beforeend",
      `<div class="category-edit" data-id="${crypto.randomUUID()}"><input type="color" aria-label="Category color" value="${colors[$("#category-fields").children.length % colors.length]}"><input type="text" aria-label="Category name" maxlength="40" placeholder="Category name"><button data-remove aria-label="Remove category">×</button></div>`,
    );
    wire();
  };
  $("#save-categories").onclick = () => {
    const categories = [...$("#category-fields").children].map((r) => ({
      id: r.dataset.id,
      name: r.querySelector("[type=text]").value.trim(),
      color: r.querySelector("[type=color]").value,
    }));
    if (categories.some((c) => !c.name)) {
      toast("Give every category a name.");
      return;
    }
    if (
      commit({
        ...data,
        categories,
        tasks: data.tasks.map((t) => ({
          ...t,
          category: categories.some((c) => c.id === t.category)
            ? t.category
            : "",
        })),
      })
    ) {
      if (!categories.some((c) => c.id === category)) category = "";
      $("#modal").close();
      render();
    }
  };
}
function chart(entries, kind) {
  const max = Math.max(1, ...entries.flatMap((e) => [e.points, e.tickets]));
  return `<div class="help chart-scale">0–${max} · tap a bar for details</div><div class="chart" role="group" aria-label="${kind}: ${esc(entries.map((e) => `${e.label}: ${e.points} points, ${e.tickets} tickets`).join("; "))}">${entries.map((e, i) => `<button type="button" class="bar-group" data-chart-label="${esc(e.label)}" aria-label="${esc(e.label)}: ${e.points} points, ${e.tickets} tickets" title="${esc(e.label)}: ${e.points} points · ${e.tickets} tickets"><div class="bars"><div class="bar" style="height:${(e.points / max) * 100}%"></div><div class="bar ticket" style="height:${(e.tickets / max) * 100}%"></div></div><span class="bar-label">${entries.length > 25 && i % 5 !== 0 ? "" : esc(e.short)}</span></button>`).join("")}</div><div class="legend"><span>Points</span><span>Tickets</span></div>`;
}
function activityHTML() {
  const today = totals(data.tasks, dateKey(new Date()));
  const completed = data.tasks.filter(
    (t) => t.status === "Done" && t.completedAt,
  );
  const total = completed.reduce((n, t) => n + t.points, 0);
  const [year, m] = month.split("-").map(Number);
  const days = new Date(year, m, 0).getDate();
  const daily = Array.from({ length: days }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { label: day, short: String(i + 1), ...totals(data.tasks, day) };
  });
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    label: `${i}:00`,
    short: i % 3 === 0 ? `${i}h` : "",
    ...totals(data.tasks, selectedDate, i),
  }));
  const dayTasks = completed
    .filter((t) => dateKey(t.completedAt) === selectedDate)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return `<div class="heading"><div><h1>Little steps add up.</h1><p>Your progress, one day at a time.</p></div></div><div class="stats"><div class="stat"><span class="eyebrow">Points today</span><strong>${today.points}</strong><small>One task at a time.</small></div><div class="stat"><span class="eyebrow">Tickets today</span><strong>${today.tickets}</strong><small>Done and dusted.</small></div><div class="stat"><span class="eyebrow">All-time points</span><strong>${total}</strong><small>${completed.length} tickets completed</small></div></div><section class="chart-panel"><div class="chart-head"><div><h2>Day by day</h2><p class="help">Points & tickets completed each day</p></div><label>Month<input type="month" id="month" value="${month}"></label></div>${chart(daily, "Daily completions")}</section><section class="chart-panel"><div class="chart-head"><div><h2>Find your rhythm</h2><p class="help">Hour by hour · your local time</p></div><label>Day<input type="date" id="day" value="${selectedDate}"></label></div>${chart(hourly, "Hourly completions")}</section><section class="chart-panel"><div class="chart-head"><h2>Completed on ${esc(selectedDate)}</h2><span class="help">${totals(data.tasks, selectedDate).points} points · ${dayTasks.length} tickets</span></div>${dayTasks.length ? `<table class="history"><thead><tr><th>Task</th><th>Category</th><th>Time</th><th>Points</th></tr></thead><tbody>${dayTasks.map((t) => `<tr><td>${esc(t.title)}</td><td>${esc(getCategory(t.category)?.name || "—")}</td><td>${new Date(t.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td><td>${t.points}</td></tr>`).join("")}</tbody></table>` : '<p class="help">Nothing completed on this day yet. Your next finished task will appear here.</p>'}</section><p class="help">History reflects completed tasks. Reopening or deleting a task removes its credit; editing its points updates its totals.</p>`;
}
function exportData() {
  const raw = storageError
    ? localStorage.getItem(KEY)
    : JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(
    new Blob([raw || ""], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `daymark-${dateKey(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Backup exported");
}
function settings() {
  modal(
    `<div class="modal-head"><h2>Workspace settings</h2><button data-close aria-label="Close">×</button></div><p class="help">Tasks and completion history live in this browser. Export a backup to keep a copy or move to another device.</p><div class="actions"><button id="settings-export">Export backup</button><button id="import">Import backup</button><input id="import-file" class="hidden" type="file" accept="application/json,.json"></div><hr><form id="password-form"><div class="fields"><label>New workspace password<input id="new-password" type="password" minlength="4" required autocomplete="new-password"></label><p class="help">A casual lock screen, not encryption. Password changes apply to this browser only.</p></div><div class="actions"><button class="primary">Change password</button></div></form>`,
  );
  $("#settings-export").onclick = exportData;
  $("#import").onclick = () => $("#import-file").click();
  $("#import-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 10000000)
        throw Error("Backup is too large (maximum 10 MB).");
      const incoming = validate(JSON.parse(await file.text()));
      if (
        confirm(
          `Replace this browser’s data with ${incoming.tasks.length} tasks and ${incoming.categories.length} categories? Export first if you need your current data.`,
        )
      ) {
        const error = storageError;
        storageError = "";
        if (commit(incoming)) {
          category = "";
          $("#modal").close();
          render();
          toast("Backup imported");
        } else storageError = error;
      }
    } catch (err) {
      toast(err.message || "Could not import this backup.");
    }
  };
  $("#password-form").onsubmit = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem("daymark.password", $("#new-password").value);
      $("#modal").close();
      toast("Password changed for this browser");
    } catch {
      toast("Could not save the password.");
    }
  };
}
document.addEventListener("keydown", (e) => {
  if (
    e.key.toLowerCase() === "c" &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) &&
    !$("#modal").open &&
    sessionStorage.getItem("daymark.unlocked")
  ) {
    e.preventDefault();
    editTask();
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    try {
      data = e.newValue ? validate(JSON.parse(e.newValue)) : initial();
      storageError = "";
      if ($("#modal").open) {
        $("#modal").close();
        toast("Data changed in another tab. Please reopen the editor.");
      }
      if (sessionStorage.getItem("daymark.unlocked")) render();
    } catch {
      toast("Another tab saved unreadable data. Export your backup.");
    }
  }
});
if (sessionStorage.getItem("daymark.unlocked")) unlock();
else renderLock();
