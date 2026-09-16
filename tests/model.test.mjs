import { test } from "node:test";
import assert from "node:assert/strict";
import { initial, transition, totals, dateKey, validate } from "../model.js";
const task = {
  id: "1",
  number: 1,
  title: "Task",
  description: "",
  category: "work",
  points: 5,
  priority: "None",
  status: "Todo",
};
test("completion, edits, reopen, and recompletion count once at the correct local hour", () => {
  const time = new Date(2026, 8, 15, 14, 30).toISOString();
  const done = transition(task, "Done", time);
  assert.deepEqual(totals([done], "2026-09-15", 14), { points: 5, tickets: 1 });
  assert.deepEqual(totals([done], "2026-09-15", 13), { points: 0, tickets: 0 });
  assert.equal(transition(done, "Done").completedAt, time);
  const reopened = transition(done, "Todo");
  assert.deepEqual(totals([reopened], "2026-09-15"), { points: 0, tickets: 0 });
  const next = transition(
    reopened,
    "Done",
    new Date(2026, 8, 16, 1).toISOString(),
  );
  assert.deepEqual(totals([next], "2026-09-16", 1), { points: 5, tickets: 1 });
});
test("local day respects midnight boundaries", () => {
  assert.equal(dateKey(new Date(2026, 8, 15, 23, 59)), "2026-09-15");
  assert.equal(dateKey(new Date(2026, 8, 16, 0, 0)), "2026-09-16");
});
test("backup validation rejects corrupt and duplicate data", () => {
  const d = { ...initial(), tasks: [task] };
  assert.equal(validate(d), d);
  assert.throws(() => validate({ ...d, tasks: [task, task] }));
  assert.throws(() => validate({ ...d, tasks: [{ ...task, points: -1 }] }));
  assert.throws(() =>
    validate({
      ...d,
      tasks: [{ ...task, status: "Done", completedAt: "bad" }],
    }),
  );
  assert.throws(() =>
    validate({
      ...d,
      categories: [{ id: "x", name: "bad", color: "red; color:red" }],
    }),
  );
});

test("due dates accept older backups and reject impossible dates", async () => {
  const { validDueDate, dueInfo } = await import("../model.js");
  assert.equal(validDueDate("2028-02-29"), true);
  assert.equal(validDueDate("2026-02-29"), false);
  assert.equal(validDueDate("2026-13-01"), false);
  assert.equal(validate({ ...initial(), tasks: [task] }).tasks.length, 1);
  assert.throws(() =>
    validate({ ...initial(), tasks: [{ ...task, dueDate: "2026-02-30" }] }),
  );
  assert.equal(
    dueInfo({ ...task, dueDate: "2026-09-15" }, "2026-09-15").label,
    "Due today",
  );
  assert.equal(
    dueInfo({ ...task, dueDate: "2026-09-14" }, "2026-09-15").overdue,
    true,
  );
  assert.equal(
    dueInfo({ ...task, status: "Done", dueDate: "2026-09-14" }, "2026-09-15")
      .overdue,
    false,
  );
  assert.equal(dueInfo(task), null);
});

test("manual ordering persists and cross-column moves preserve completion semantics", async () => {
  const { moveTask } = await import("../model.js");
  const tasks = [
    { ...task, id: "a" },
    { ...task, id: "b" },
    { ...task, id: "c" },
  ];
  const moved = moveTask(tasks, "c", "Todo", "a");
  assert.deepEqual(
    moved.map((t) => t.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    moveTask(moved, "c", "Todo", "a", true).map((t) => t.id),
    ["a", "c", "b"],
  );
  const done = moveTask(tasks, "b", "Done");
  assert.equal(done[2].status, "Done");
  assert.ok(done[2].completedAt);
  assert.equal(
    moveTask(done, "b", "Done", "a")[0].completedAt,
    done[2].completedAt,
  );
  assert.equal(moveTask(done, "b", "Todo", "a")[0].completedAt, null);
  assert.deepEqual(
    JSON.parse(JSON.stringify(moved)).map((t) => t.id),
    ["c", "a", "b"],
  );
  assert.equal(moveTask(tasks, "a", "Todo", "a"), tasks);
});

test("cloud import merges missing records without overwriting existing tasks", async () => {
  const { mergeBackup } = await import("../src/backup.js");
  const current = { ...initial(), tasks: [{ ...task, title: "Newer task" }] };
  const incoming = {
    ...initial(),
    tasks: [task, { ...task, id: "new", dueDate: "2026-09-18" }],
  };
  const result = mergeBackup(current, incoming, "merge");
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks[0].title, "Newer task");
  assert.equal(result.tasks[1].dueDate, "2026-09-18");
  assert.equal(mergeBackup(result, incoming, "merge").tasks.length, 2);
  assert.equal(
    mergeBackup(current, incoming, "replace").tasks[0].title,
    "Task",
  );
});

test("stale edit checks compare values rather than Firestore field order", async () => {
  const { sameRecord } = await import("../model.js");
  assert.equal(
    sameRecord({ id: "x", title: "A" }, { title: "A", id: "x" }),
    true,
  );
  assert.equal(
    sameRecord({ id: "x", title: "A" }, { id: "x", title: "B" }),
    false,
  );
  assert.equal(sameRecord(undefined, { id: "x" }), false);
});

test("category analytics count only completions in the selected local period", async () => {
  const { categoryCompletions } = await import('../model.js');
  const data = { categories: [{ id: 'work', name: 'Work', color: '#607744' }], tasks: [
    { ...task, status: 'Done', completedAt: new Date(2026, 8, 16, 12).toISOString() },
    { ...task, id: '2', category: '', points: 0, status: 'Done', completedAt: new Date(2026, 8, 16, 13).toISOString() },
    { ...task, id: '3', points: 8, status: 'Done', completedAt: new Date(2026, 7, 31, 12).toISOString() },
    { ...task, id: '4', status: 'Todo', completedAt: new Date(2026, 8, 16, 12).toISOString() },
  ] };
  const rows = categoryCompletions(data, '2026-09');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].points, 5);
  assert.equal(rows[0].tickets, 1);
  assert.equal(rows[0].share, 0.5);
  assert.equal(rows[1].average, 0);
  assert.equal(categoryCompletions(data, '2026-09-17').length, 0);
  assert.equal(categoryCompletions(data, 'all')[0].points, 13);
});
