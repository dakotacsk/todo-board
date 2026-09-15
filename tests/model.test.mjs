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
