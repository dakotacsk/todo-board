# Daymark

Personal task board for Dakota, matching the warm paper, olive, and handwriting styles of [dakotacsk.com](https://dakotacsk.com).

## Deployment status

Firebase project `daymark-dakotacsk` is owned by `dakotacsk@gmail.com`. The React app and owner-only Firestore rules are deployed at https://daymark-dakotacsk.web.app. Google authentication is enabled. The database uses the free tier in `us-east1`; no billing account is attached.

GitHub automatic deployment credentials are awaiting approval. The existing production board remains at https://dakotacsk.com/todo-board/ until the migration is merged and Pages switches to Actions.

## Features

- Color-coded categories; board and list views; search; notes and priorities.
- Optional due dates with due-today and overdue labels.
- Manual ordering through drag-and-drop or up/down buttons.
- Points and completed ticket charts by day/month and hour/date.
- Google sign-in restricted to verified `dakotacsk@gmail.com`, enforced by Firestore rules.
- Live updates across signed-in devices, transaction revision checks, and stale editor protection.
- Explicit loading, offline, save-failure, and unauthorized-account states.
- JSON backup export, merge import (deduplicated by ID), and explicit replace import.

Reopening/deleting a completed task removes its credit. Editing its points changes its history totals. Times are displayed in the browser's local timezone.

## Existing browser data

The app reads, but never deletes or overwrites, `daymark.data.v1` from the old board. On the original Pages URL, Google sign-in is followed by a review/import banner. Default import adds missing tasks and preserves current cloud records. Settings can export the original browser copy.

A Firebase `.web.app` address is a different origin and cannot see the old Pages localStorage. Export JSON from the old address and import it when using a different origin.

## Development

Node 22+; Java 21+ for the Firestore emulator.

```sh
npm ci
npm start
npm test
npm run test:rules
npm run build
```

Emulator UI testing:

```sh
npx firebase emulators:start --only auth,firestore --project demo-daymark
VITE_USE_EMULATORS=true npm start
```

Emulator mode exposes a local test identity button, compiled out of production. No production authentication bypass exists. During emulator testing use the demo config in `src/firebase-config.json`.

## Deployment integration

`.github/workflows/deploy.yml` tests and builds pull requests. On `main`, it deploys Firestore rules and Firebase Hosting, then deploys the same build to GitHub Pages. The existing URL and the Firebase URL use the same cloud board.

Setup required:

1. Create a no-billing Firebase Spark project under the personal account.
2. Register a web app and replace `src/firebase-config.json` with the Firebase web config. This config is public; authorization is enforced by rules.
3. Create the default Firestore database and enable Google authentication. Add `dakotacsk.com` and the Firebase hosting domain to authorized domains.
4. Set `.firebaserc` default project and deploy `firestore.rules`.
5. Create a narrowly scoped deployment service account, store its JSON only in the repository Actions secret `FIREBASE_DEPLOY_CREDENTIALS`, and remove the temporary local key file. Do not commit service-account keys.
6. Switch this repository's Pages build type to GitHub Actions before merging.
7. Verify both deployed URLs and a real owner login. Import original browser data from the Pages URL.

The deployment identity needs Firebase Hosting Admin, Firebase Rules Admin, Firebase Viewer, and Service Usage Consumer for this project. It does not need Owner, Editor, or access to task documents.

## Storage model

A private document at `users/{uid}/boards/main` stores categories, tasks, manual order, and a revision. Atomic transactions reject stale revisions; individual editors also reject stale task/category edits. Cloud data is held in memory by the SDK; offline writes are disabled and pending edits are not reported as saved. On sign-out, React clears the board and closes editors.

This compact personal-board model is capped at 750 KB, 3,000 tasks, and 100 categories to stay below Firestore's document limit. Export and prune older completed tasks if reached. No billing account, analytics, Cloud Functions, or paid App Hosting is required.

## Credential safeguards

The Firebase web configuration is intentionally public, as it is downloaded by every browser. Its API key does not authorize access to task data; Firestore rules enforce the verified owner account. Do not reuse this key for other Google APIs. Moving a browser key to a frontend environment variable would not make it secret.

Run `npm run hooks:install` once per clone to install the staged-content credential check. CI also scans commits for common private-key, OAuth, service-account, GitHub, AWS, Slack, and Google API-key patterns. Only the `apiKey` property of this project's Firebase web config is exempt. Checks never print matched values. These pattern checks are a safeguard, not a guarantee; never place real credentials in frontend code, comments, fixtures, issues, or logs. Keep server credentials in a secret manager or GitHub Actions secrets. Local environment files and common credential filenames are ignored.
