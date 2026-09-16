import { mergeBackup } from "./backup.js";
import React, { useState, useEffect, useRef } from "react";
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
  sameRecord,
  categoryCompletions,
} from "../model.js";
import {
  watchAuth,
  watchBoard,
  login,
  logout,
  isOwner,
  saveBoard,
  friendlyError,
  OWNER_EMAIL,
  loginEmulator,
} from "./cloud.js";

const LEGACY_KEY = "daymark.data.v1";
const icons = ["◌", "○", "◔", "●"];
function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? validate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function download(data) {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { version: 1, categories: data.categories, tasks: data.tasks },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `daymark-${dateKey(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Brand() {
  return (
    <div className="brand">
      <img className="brand-logo" src={`${import.meta.env.BASE_URL}daymark-logo.png`} alt="" width="36" height="36" />daymark
    </div>
  );
}
function Modal({ title, children, onClose, busy = false }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button onClick={onClose} disabled={busy} aria-label="Close">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function useDay() {
  const [day, setDay] = useState(dateKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => setDay(dateKey(new Date())), 30000);
    return () => clearInterval(id);
  }, []);
  return day;
}

export default function App() {
  const [user, setUser] = useState(undefined),
    [board, setBoard] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [authBusy, setAuthBusy] = useState(false);
  const [view, setView] = useState("board"),
    [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [layout, setLayout] = useState("board"),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState("");
  const [legacy] = useState(readLegacy),
    [dismissLegacy, setDismissLegacy] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const session = useRef(0);
  const today = useDay();
  useEffect(
    () =>
      watchAuth((next) => {
        session.current++;
        setBoard(null);
        setModal(null);
        setError("");
        setUser(next);
      }),
    [],
  );
  useEffect(() => {
    if (!isOwner(user)) return;
    const epoch = session.current;
    return watchBoard(
      user.uid,
      (next) => {
        if (session.current === epoch) {
          setBoard(next);
          setError("");
        }
      },
      (err) => {
        if (session.current === epoch) setError(friendlyError(err));
      },
    );
  }, [user]);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const key = (e) => {
      if (
        e.key.toLowerCase() === "c" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.target.isContentEditable &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) &&
        board &&
        !modal
      ) {
        e.preventDefault();
        setModal({ type: "task", status: "Todo" });
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [board, modal]);
  const canEdit = !!board && !board.fromCache && online && !busy && !error;
  async function change(recipe, message = "Saved") {
    if (!canEdit) {
      setToast("Connect to Firebase before making changes.");
      return false;
    }
    const epoch = session.current;
    setBusy(true);
    try {
      const result = await saveBoard(user.uid, board.revision, recipe);
      if (epoch === session.current) {
        setBoard((current) =>
          current && current.revision > result.revision
            ? current
            : { data: result, revision: result.revision, fromCache: false },
        );
        setToast(message);
      }
      return epoch === session.current;
    } catch (e) {
      setToast(friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    setAuthBusy(true);
    setError("");
    try {
      await login();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setAuthBusy(false);
    }
  }
  async function signOut() {
    setModal(null);
    try {
      await logout();
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  if (user === undefined)
    return (
      <main className="lock">
        <div className="lock-box">
          <Brand />
          <p>Opening your workspace…</p>
        </div>
      </main>
    );
  if (!user || !isOwner(user))
    return (
      <main className="lock">
        <div className="lock-box">
          <Brand />
          <h1>
            A little space for
            <br />
            getting things done.
          </h1>
          <p>Your tasks, wherever you are.</p>
          <div className="signin">
            {import.meta.env.DEV &&
              import.meta.env.VITE_USE_EMULATORS === "true" && (
                <button
                  onClick={() =>
                    loginEmulator().catch((e) => setError(friendlyError(e)))
                  }
                >
                  Sign in as local test owner
                </button>
              )}
            <button
              className="primary"
              disabled={authBusy}
              onClick={user ? signOut : signIn}
            >
              {authBusy
                ? "Signing in…"
                : user
                  ? "Use a different account"
                  : "Continue with Google →"}
            </button>
            <p className="error" role="alert">
              {user ? `This workspace is private to ${OWNER_EMAIL}.` : error}
            </p>
          </div>
          <small>
            Personal workspace · Dakota Chang
            <br />
            Your tasks sync securely with your Google account.
          </small>
        </div>
      </main>
    );
  const data = board?.data || initial();
  const getCategory = (id) => data.categories.find((c) => c.id === id);
  const count = totals(data.tasks, today);
  const filtered = data.tasks.filter(
    (t) =>
      (!category || t.category === category) &&
      `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const navigate = (v, c = "") => {
    setView(v);
    setCategory(c);
    setMenu(false);
    setQuery("");
  };
  async function reorder(id, status, targetId = null, after = false) {
    await change(
      (d) => ({ ...d, tasks: moveTask(d.tasks, id, status, targetId, after) }),
      "Task moved",
    );
  }
  return (
    <>
      <div className="shell">
        <aside className={`sidebar ${menu ? "open" : ""}`}>
          <div>
            <Brand />
            <div className="workspace">Dakota’s workspace</div>
          </div>
          <nav>
            <button
              className={`navitem ${view === "board" && !category ? "active" : ""}`}
              onClick={() => navigate("board")}
            >
              ▦ <span>All tasks</span>
              <span className="count">
                {data.tasks.filter((t) => t.status !== "Done").length}
              </span>
            </button>
            <button
              className={`navitem ${view === "activity" ? "active" : ""}`}
              onClick={() => navigate("activity")}
            >
              ↗ <span>Activity</span>
            </button>
          </nav>
          <section>
            <div className="section-label">
              <span className="eyebrow">Categories</span>
              <button
                aria-label="Manage categories"
                disabled={!canEdit}
                onClick={() =>
                  setModal({ type: "categories", original: data.categories })
                }
              >
                +
              </button>
            </div>
            <nav>
              {data.categories.map((c) => (
                <button
                  key={c.id}
                  className={`navitem ${category === c.id && view === "board" ? "active" : ""}`}
                  onClick={() => navigate("board", c.id)}
                >
                  <span className="dot" style={{ "--cat": c.color }} />
                  {c.name}
                  <span className="count">
                    {
                      data.tasks.filter(
                        (t) => t.category === c.id && t.status !== "Done",
                      ).length
                    }
                  </span>
                </button>
              ))}
            </nav>
          </section>
          <div className="bottom">
            <button disabled={!board} onClick={() => download(data)}>
              ↗ &nbsp; Export backup
            </button>
            <button onClick={() => setModal({ type: "settings" })}>
              ⚙ &nbsp; Settings
            </button>
            <button disabled={busy} onClick={signOut}>
              ↪ &nbsp; Sign out
            </button>
            <div className="local">
              <span>●</span> &nbsp;{" "}
              {busy
                ? "Saving…"
                : !online
                  ? "Offline · changes paused"
                  : error
                    ? "Sync unavailable"
                    : !board
                      ? "Connecting…"
                      : board.fromCache
                        ? "Connecting…"
                        : "Synced with Firebase"}
            </div>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div className="crumb">
              <button
                className="mobile-menu"
                aria-label="Toggle menu"
                onClick={() => setMenu(!menu)}
              >
                ☰
              </button>
              My workspace &nbsp; / &nbsp;{" "}
              <b>{view === "activity" ? "Activity" : "Tasks"}</b>
            </div>
            <div className="topright">
              <span>
                {new Date().toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                className="primary"
                disabled={!canEdit}
                onClick={() => setModal({ type: "task", status: "Todo" })}
              >
                + New task <kbd>C</kbd>
              </button>
            </div>
          </header>
          <div className="content">
            {error && (
              <p className="error" role="alert">
                {error} <button onClick={() => location.reload()}>Retry</button>
              </p>
            )}
            {!board ? (
              <p>Connecting to your saved board…</p>
            ) : (
              <>
                {legacy?.tasks.length > 0 && !dismissLegacy && (
                  <div className="migration">
                    <div>
                      <strong>
                        Your browser has {legacy.tasks.length} saved tasks.
                      </strong>
                      <p className="help">
                        Bring them into your synced board, including points,
                        history, and due dates.
                      </p>
                    </div>
                    <button
                      disabled={!canEdit}
                      onClick={() =>
                        setModal({ type: "import", incoming: legacy })
                      }
                    >
                      Review import
                    </button>
                    <button
                      aria-label="Dismiss import notice"
                      onClick={() => setDismissLegacy(true)}
                    >
                      ×
                    </button>
                  </div>
                )}
                {view === "activity" ? (
                  <Activity data={data} today={today} notify={setToast} />
                ) : (
                  <>
                    <div className="heading">
                      <div>
                        <h1>{getCategory(category)?.name || "My board"}</h1>
                        <p>A little progress, every day.</p>
                      </div>
                      <div className="today">
                        <div>
                          <strong>
                            {count.points}
                            <span className="unit"> pts</span>
                          </strong>
                          <small>COMPLETED TODAY</small>
                        </div>
                        <div>
                          <strong>{count.tickets}</strong>
                          <small>TASKS DONE</small>
                        </div>
                      </div>
                    </div>
                    <div className="toolbar">
                      <input
                        className="search"
                        type="search"
                        placeholder="Search tasks…"
                        aria-label="Search tasks"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <div className="switch">
                        <button
                          className={layout === "board" ? "active" : ""}
                          onClick={() => setLayout("board")}
                        >
                          ▦ Board
                        </button>
                        <button
                          className={layout === "list" ? "active" : ""}
                          onClick={() => setLayout("list")}
                        >
                          ☰ List
                        </button>
                      </div>
                    </div>
                    <div className={layout}>
                      {statuses.map((status, i) => {
                        const group = filtered.filter(
                          (t) => t.status === status,
                        );
                        return (
                          <section
                            className="column"
                            key={status}
                            onDragOver={(e) => {
                              if (canEdit) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (canEdit)
                                reorder(
                                  e.dataTransfer.getData("text/plain"),
                                  status,
                                );
                            }}
                          >
                            <div className="column-head">
                              <span className={`status-icon status-${i}`}>
                                {icons[i]}
                              </span>
                              {status}
                              <span className="num">{group.length}</span>
                              <button
                                disabled={!canEdit}
                                aria-label={`Add task to ${status}`}
                                onClick={() =>
                                  setModal({ type: "task", status })
                                }
                              >
                                +
                              </button>
                            </div>
                            {group.length ? (
                              group.map((t, index) => (
                                <TaskCard
                                  key={t.id}
                                  task={t}
                                  category={getCategory(t.category)}
                                  today={today}
                                  disabled={!canEdit}
                                  first={index === 0}
                                  last={index === group.length - 1}
                                  onEdit={() =>
                                    setModal({ type: "task", task: t })
                                  }
                                  onMove={(down) =>
                                    reorder(
                                      t.id,
                                      status,
                                      group[index + (down ? 1 : -1)]?.id,
                                      down,
                                    )
                                  }
                                  onDrop={(id) => reorder(id, status, t.id)}
                                />
                              ))
                            ) : (
                              <div className="empty">
                                {query
                                  ? "No matching tasks"
                                  : "Room for your next step."}
                              </div>
                            )}
                            <button
                              className="add-card"
                              disabled={!canEdit}
                              onClick={() => setModal({ type: "task", status })}
                            >
                              + Add task
                            </button>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      {modal?.type === "task" && (
        <TaskEditor
          task={modal.task}
          status={modal.status}
          category={category}
          data={data}
          busy={busy}
          onClose={() => setModal(null)}
          onDelete={() => setModal({ type: "delete", task: modal.task })}
          onSave={async (task) => {
            if (
              await change((d) => {
                if (
                  modal.task &&
                  !sameRecord(
                    d.tasks.find((t) => t.id === task.id),
                    modal.task,
                  )
                )
                  throw Error(
                    "This task changed on another device. Close the editor and reopen it to review the latest version.",
                  );
                return {
                  ...d,
                  tasks: modal.task
                    ? d.tasks.map((t) => (t.id === task.id ? task : t))
                    : [
                        ...d.tasks,
                        {
                          ...task,
                          number:
                            Math.max(0, ...d.tasks.map((t) => t.number || 0)) +
                            1,
                        },
                      ],
                };
              }, "Task saved")
            )
              setModal(null);
          }}
        />
      )}
      {modal?.type === "categories" && (
        <Categories
          categories={data.categories}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={async (categories) => {
            if (
              await change((d) => {
                if (
                  JSON.stringify(d.categories) !==
                  JSON.stringify(modal.original)
                )
                  throw Error(
                    "Categories changed on another device. Reopen the editor to review them.",
                  );
                return {
                  ...d,
                  categories,
                  tasks: d.tasks.map((t) => ({
                    ...t,
                    category: categories.some((c) => c.id === t.category)
                      ? t.category
                      : "",
                  })),
                };
              })
            ) {
              setCategory("");
              setModal(null);
            }
          }}
        />
      )}
      {modal?.type === "delete" && (
        <Modal
          title="Delete this task?"
          busy={busy}
          onClose={() => setModal(null)}
        >
          <p>“{modal.task.title}” and its completion credit will be removed.</p>
          <div className="actions">
            <button disabled={busy} onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await change(
                    (d) => ({
                      ...d,
                      tasks: d.tasks.filter((t) => t.id !== modal.task.id),
                    }),
                    "Task deleted",
                  )
                )
                  setModal(null);
              }}
            >
              Delete task
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "settings" && (
        <Settings
          user={user}
          legacy={legacy}
          data={data}
          canEdit={canEdit}
          onClose={() => setModal(null)}
          onImport={(incoming) => setModal({ type: "import", incoming })}
          onError={setToast}
        />
      )}
      {modal?.type === "import" && (
        <ImportDialog
          incoming={modal.incoming}
          current={data}
          busy={busy}
          onClose={() => setModal(null)}
          onImport={async (mode) => {
            if (
              await change(
                (d) => mergeBackup(d, modal.incoming, mode),
                "Backup imported",
              )
            ) {
              setDismissLegacy(true);
              setModal(null);
            }
          }}
        />
      )}
      {toast && (
        <div id="toast" role="status" style={{ display: "block" }}>
          {toast}
        </div>
      )}
    </>
  );
}

function TaskCard({
  task: t,
  category: c,
  today,
  disabled,
  first,
  last,
  onEdit,
  onMove,
  onDrop,
}) {
  const due = dueInfo(t, today);
  const [over, setOver] = useState(false);
  return (
    <article
      className={`card ${over ? "drop-before" : ""}`}
      style={{ "--cat": c?.color || "#99958b" }}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!disabled) {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDragEnd={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (!disabled) onDrop(e.dataTransfer.getData("text/plain"));
      }}
    >
      <button
        className="card-open"
        aria-label={`Edit ${t.title}`}
        onClick={onEdit}
      >
        <div className="card-id">
          DM-{t.number}
          {t.priority === "High" ? " · High priority" : ""}
        </div>
        <div className="card-title">{t.title}</div>
        <div className="card-footer">
          {c ? (
            <span className="tag">{c.name}</span>
          ) : (
            <span>Uncategorized</span>
          )}
          <span className="points">{t.points} pts</span>
        </div>
        {due && (
          <span className={`due-date ${due.overdue ? "overdue" : ""}`}>
            {due.label}
          </span>
        )}
      </button>
      <div className="reorder">
        <span
          className="drag-handle"
          title="Drag to reorder"
          aria-hidden="true"
        >
          ⠿
        </span>
        <button
          disabled={disabled || first}
          aria-label={`Move ${t.title} up`}
          onClick={() => onMove(false)}
        >
          ↑
        </button>
        <button
          disabled={disabled || last}
          aria-label={`Move ${t.title} down`}
          onClick={() => onMove(true)}
        >
          ↓
        </button>
      </div>
    </article>
  );
}
function TaskEditor({
  task,
  status,
  category,
  data,
  busy,
  onClose,
  onSave,
  onDelete,
}) {
  const [t, setT] = useState(
    task || {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      category,
      points: 1,
      priority: "None",
      status: status || "Todo",
      dueDate: "",
      createdAt: new Date().toISOString(),
    },
  );
  const update = (key, value) => setT((old) => ({ ...old, [key]: value }));
  return (
    <Modal
      title={task ? "Edit task" : "New task"}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (t.title.trim())
            onSave(
              transition(
                {
                  ...t,
                  title: t.title.trim(),
                  completedAt: task?.completedAt || null,
                },
                t.status,
              ),
            );
        }}
      >
        <fieldset disabled={busy}>
          <div className="fields">
            <label>
              Title
              <input
                autoFocus
                required
                maxLength={200}
                value={t.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="What would you like to get done?"
              />
            </label>
            <label>
              Notes
              <textarea
                maxLength={20000}
                value={t.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="A few details, if you need them…"
              />
            </label>
            <div className="row">
              <label>
                Status
                <select
                  value={t.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <select
                  value={t.category}
                  onChange={(e) => update("category", e.target.value)}
                >
                  <option value="">Uncategorized</option>
                  {data.categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row">
              <label>
                Points
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  required
                  value={t.points}
                  onChange={(e) =>
                    update(
                      "points",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Priority
                <select
                  value={t.priority}
                  onChange={(e) => update("priority", e.target.value)}
                >
                  {["None", "Low", "Medium", "High"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Due date
              <input
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={t.dueDate || ""}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </label>
            {task?.completedAt && (
              <p className="help">
                Completed {new Date(task.completedAt).toLocaleString()}.
                Reopening removes this completion from Activity.
              </p>
            )}
          </div>
          <div className="actions">
            {task && (
              <button type="button" className="danger" onClick={onDelete}>
                Delete task
              </button>
            )}
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary">
              {busy ? "Saving…" : task ? "Save changes" : "Create task"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
function Categories({ categories, busy, onClose, onSave }) {
  const [items, setItems] = useState(categories);
  const [error, setError] = useState("");
  return (
    <Modal title="Your categories" busy={busy} onClose={onClose}>
      <p className="help">Give each part of your life its own color.</p>
      <fieldset disabled={busy}>
        {items.map((c, i) => (
          <div className="category-edit" key={c.id}>
            <input
              aria-label="Category color"
              type="color"
              value={c.color}
              onChange={(e) =>
                setItems(
                  items.map((v, j) =>
                    i === j ? { ...v, color: e.target.value } : v,
                  ),
                )
              }
            />
            <input
              type="text"
              aria-label="Category name"
              maxLength={40}
              value={c.name}
              onChange={(e) =>
                setItems(
                  items.map((v, j) =>
                    i === j ? { ...v, name: e.target.value } : v,
                  ),
                )
              }
            />
            <button
              aria-label={`Remove ${c.name}`}
              onClick={() => setItems(items.filter((v, j) => i !== j))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          disabled={items.length >= 100}
          onClick={() =>
            setItems([
              ...items,
              {
                id: crypto.randomUUID(),
                name: "",
                color: colors[items.length % colors.length],
              },
            ])
          }
        >
          + Add category
        </button>
        <p className="help">
          Removing a category keeps its tasks as Uncategorized.
        </p>
        <p className="error" role="alert">
          {error}
        </p>
        <div className="actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={() => {
              if (items.some((c) => !c.name.trim()))
                setError("Give every category a name.");
              else onSave(items.map((c) => ({ ...c, name: c.name.trim() })));
            }}
          >
            Save categories
          </button>
        </div>
      </fieldset>
    </Modal>
  );
}
function Settings({ user, legacy, data, canEdit, onClose, onImport, onError }) {
  const file = useRef();
  return (
    <Modal title="Workspace settings" onClose={onClose}>
      <p>Signed in as {user.email}</p>
      <p className="help">
        Tasks, categories, due dates, and completion history sync across your
        devices. Export a backup any time.
      </p>
      <div className="actions">
        <button onClick={() => download(data)}>Export backup</button>
        <button disabled={!canEdit} onClick={() => file.current.click()}>
          Import backup
        </button>
        <input
          ref={file}
          className="hidden"
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              if (f.size > 10000000)
                throw Error("Backup is too large (maximum 10 MB).");
              onImport(validate(JSON.parse(await f.text())));
            } catch (err) {
              onError(err.message);
            }
          }}
        />
      </div>
      {legacy && (
        <>
          <hr />
          <h2>Previous browser data</h2>
          <p className="help">
            Your original {legacy.tasks.length} tasks are still saved in this
            browser.
          </p>
          <div className="actions">
            <button onClick={() => download(legacy)}>
              Export original data
            </button>
            <button disabled={!canEdit} onClick={() => onImport(legacy)}>
              Import original data
            </button>
          </div>
        </>
      )}
      <hr />
      <p className="help">
        Only your Google account has access. The old casual password is no
        longer used.
      </p>
    </Modal>
  );
}
function ImportDialog({ incoming, current, busy, onClose, onImport }) {
  const [mode, setMode] = useState("merge");
  const newCount = incoming.tasks.filter(
    (t) => !current.tasks.some((x) => x.id === t.id),
  ).length;
  return (
    <Modal title="Import your tasks" busy={busy} onClose={onClose}>
      <p>
        This backup has {incoming.tasks.length} tasks and{" "}
        {incoming.categories.length} categories.
      </p>
      <label className="import-mode">
        Import method
        <select
          value={mode}
          disabled={busy}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="merge">Add missing tasks ({newCount} new)</option>
          <option value="replace">Replace the entire cloud board</option>
        </select>
      </label>
      <p className="help">
        {mode === "merge"
          ? "Existing tasks and categories keep their current values. Original browser data stays untouched."
          : "This replaces all cloud tasks and categories. Export your current board first if you need to keep a copy."}
      </p>
      <div className="actions">
        <button onClick={() => download(current)}>Export current board</button>
        <button disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => onImport(mode)}
        >
          {busy
            ? "Importing…"
            : mode === "merge"
              ? "Add missing tasks"
              : "Replace cloud board"}
        </button>
      </div>
    </Modal>
  );
}
function Chart({ entries, label, onSelect }) {
  const max = Math.max(1, ...entries.flatMap((e) => [e.points, e.tickets]));
  return (
    <>
      <div className="help chart-scale">0–{max} · tap a bar for details</div>
      <div className="chart" role="group" aria-label={label}>
        {entries.map((e, i) => (
          <button
            className="bar-group"
            key={e.label}
            aria-label={`${e.label}: ${e.points} points, ${e.tickets} tickets`}
            title={`${e.label}: ${e.points} points · ${e.tickets} tickets`}
            onClick={() => onSelect(e)}
          >
            <div className="bars">
              <div
                className="bar"
                style={{ height: `${(e.points / max) * 100}%` }}
              />
              <div
                className="bar ticket"
                style={{ height: `${(e.tickets / max) * 100}%` }}
              />
            </div>
            <span className="bar-label">
              {entries.length > 25 && i % 5 !== 0 ? "" : e.short}
            </span>
          </button>
        ))}
      </div>
      <div className="legend">
        <span>Points</span>
        <span>Tickets</span>
      </div>
    </>
  );
}
function CategoryAnalytics({ data, day, month }) {
  const [period, setPeriod] = useState("month");
  const rows = categoryCompletions(data, period === "all" ? "all" : period === "day" ? day : month);
  const tickets = rows.reduce((n, row) => n + row.tickets, 0);
  const points = rows.reduce((n, row) => n + row.points, 0);
  return <section className="chart-panel">
    <div className="chart-head">
      <div><h2>Where your progress goes</h2><p className="help">Completed tickets by category · {period === "all" ? "All time" : period === "day" ? day : month}</p></div>
      <label>Category breakdown<select value={period} onChange={e => setPeriod(e.target.value)}>
        <option value="day">Selected day</option><option value="month">Selected month</option><option value="all">All time</option>
      </select></label>
    </div>
    <p className="help">{tickets} tickets · {points} points · {tickets ? (points / tickets).toFixed(1) : "0"} average points per ticket</p>
    {rows.length ? <div className="category-metrics">{rows.map(row => <div className="category-metric" key={row.id}>
      <div className="category-metric-title"><span><i style={{ background: row.color }} />{row.name}</span><strong>{row.tickets} {row.tickets === 1 ? "ticket" : "tickets"} · {row.points} pts</strong></div>
      <div className="category-meter" aria-hidden="true"><div style={{ width: `${row.share * 100}%`, background: row.color }} /></div>
      <p className="help">{Math.round(row.share * 100)}% of completed tickets · {row.average.toFixed(1)} average pts</p>
    </div>)}</div> : <p className="help">No completed tickets in this period. Finish a task or choose another period to see the breakdown.</p>}
    <p className="help">Uses current task categories. Uncategorized tasks are included.</p>
  </section>;
}

function Activity({ data, today, notify }) {
  const [month, setMonth] = useState(today.slice(0, 7)),
    [day, setDay] = useState(today);
  const completed = data.tasks.filter(
    (t) => t.status === "Done" && t.completedAt,
  );
  const count = totals(data.tasks, today);
  const [year, m] = month.split("-").map(Number);
  const daily = Array.from(
    { length: new Date(year, m, 0).getDate() },
    (_, i) => {
      const d = `${month}-${String(i + 1).padStart(2, "0")}`;
      return { label: d, short: String(i + 1), ...totals(data.tasks, d) };
    },
  );
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    label: `${i}:00`,
    short: i % 3 === 0 ? `${i}h` : "",
    ...totals(data.tasks, day, i),
  }));
  const rows = completed
    .filter((t) => dateKey(t.completedAt) === day)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const detail = (e) =>
    notify(`${e.label}: ${e.points} points · ${e.tickets} tickets`);
  return (
    <>
      <div className="heading">
        <div>
          <h1>Little steps add up.</h1>
          <p>Your progress, one day at a time.</p>
        </div>
      </div>
      <div className="stats">
        {[
          ["Points today", count.points, "One task at a time."],
          ["Tickets today", count.tickets, "Done and dusted."],
          [
            "All-time points",
            completed.reduce((n, t) => n + t.points, 0),
            `${completed.length} tickets completed`,
          ],
        ].map(([label, value, help]) => (
          <div className="stat" key={label}>
            <span className="eyebrow">{label}</span>
            <strong>{value}</strong>
            <small>{help}</small>
          </div>
        ))}
      </div>
      <section className="chart-panel">
        <div className="chart-head">
          <div>
            <h2>Day by day</h2>
            <p className="help">Points & tickets completed each day</p>
          </div>
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
        </div>
        <Chart
          entries={daily}
          label="Daily completions"
          onSelect={(e) => {
            setDay(e.label);
            detail(e);
          }}
        />
      </section>
      <section className="chart-panel">
        <div className="chart-head">
          <div>
            <h2>Find your rhythm</h2>
            <p className="help">Hour by hour · your local time</p>
          </div>
          <label>
            Day
            <input
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          </label>
        </div>
        <Chart entries={hourly} label="Hourly completions" onSelect={detail} />
      </section>
      <CategoryAnalytics data={data} day={day} month={month} />
      <section className="chart-panel">
        <div className="chart-head">
          <h2>Completed on {day}</h2>
          <span className="help">
            {totals(data.tasks, day).points} points · {rows.length} tickets
          </span>
        </div>
        {rows.length ? (
          <table className="history">
            <thead>
              <tr>
                <th>Task</th>
                <th>Category</th>
                <th>Time</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>
                    {data.categories.find((c) => c.id === t.category)?.name ||
                      "—"}
                  </td>
                  <td>
                    {new Date(t.completedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="help">
            Nothing completed on this day yet. Your next finished task will
            appear here.
          </p>
        )}
      </section>
      <p className="help">
        History reflects completed tasks. Reopening or deleting a task removes
        its credit; editing its points updates its totals.
      </p>
    </>
  );
}
