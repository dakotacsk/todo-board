export function mergeBackup(current, incoming, mode) {
  if (mode === "replace")
    return {
      version: 1,
      categories: incoming.categories,
      tasks: incoming.tasks,
    };
  const catIds = new Set(current.categories.map((c) => c.id));
  const taskIds = new Set(current.tasks.map((t) => t.id));
  return {
    ...current,
    categories: [
      ...current.categories,
      ...incoming.categories.filter((c) => !catIds.has(c.id)),
    ],
    tasks: [
      ...current.tasks,
      ...incoming.tasks.filter((t) => !taskIds.has(t.id)),
    ],
  };
}
