# Daymark

A personal, light-mode task board styled to match [dakotacsk.com](https://dakotacsk.com). Static HTML, CSS, and JavaScript, hosted free on GitHub Pages.

## Use

- Live: https://dakotacsk.com/todo-board/
- Initial casual-lock password: `little-steps`. Change it for your browser in Settings.
- Create tasks with **New task** or **C**. Add notes, category, priority, and 0–100 points.
- Move tasks through Backlog, Todo, In progress, and Done. Drag cards on desktop or edit Status on any device.
- Create, rename, recolor, and remove categories. Removing a category preserves its tasks.
- Search and filter tasks; switch between board and list layouts.
- Activity charts show daily history by month and hourly history for any date, in the browser's local timezone.
- Completing a task records a timestamp. Reopening/deleting removes the credit; changing points updates historical totals. This measures currently completed tasks, not an immutable event ledger.

## Persistence and privacy

All tasks, categories, and completion timestamps live in **localStorage in the current browser**, under `daymark.data.v1`. Reloading preserves them. Clearing site data, switching browsers, or switching devices does not preserve/share them. No task data is sent to GitHub or another server. Same-origin tabs synchronize changes, but simultaneous edits can be last-write-wins.

**Export backup** downloads JSON; **Settings → Import backup** restores a backup after confirming replacement. Export regularly. Keep using the canonical custom-domain URL: other origins have separate browser storage.

The password screen is intentionally cosmetic, not authentication or encryption. Source is public and the initial password is in it. Password changes are browser-local. Do not use this to protect sensitive information.

## Development

Requires Python 3 for the preview and Node.js for tests. No build step or runtime dependencies.

```sh
npm start
npm test
```

Visit http://localhost:4173. Fonts are copied from the personal site's existing assets.

## Publishing

GitHub Pages publishes the root of `main`. Pushes to `main` automatically rebuild the site. The personal site's custom domain makes the project available at `/todo-board/`; its existing pages are untouched.
