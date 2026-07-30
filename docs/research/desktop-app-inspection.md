# Todoist desktop app inspection (v9.29.1, macOS, 2026-07-30)

Read-only inspection of `/Applications/Todoist.app` (asar) and
`~/Library/Application Support/Todoist/`. Full evidence in session log; highlights:

## Architecture — thin wrapper, not a bundled app

- The asar ships NO renderer: it `loadURL`s **https://app.todoist.com** live.
  Repo: `github.com/doist/todoist-electron`. Electron 42, contextIsolation on,
  nodeIntegration off, minimal ipcRenderer preload bridge.
- "Local-first" is the web PWA: service worker + IndexedDB (LevelDB) sync cache
  in the Chromium profile. No app-owned SQLite anywhere.
- **Implication: Dash (real local DB, bundled renderer) is architecturally more
  local-first than Todoist itself.** Nothing to copy from their storage design.

## Desktop-native features (the actual value of their shell — our Core targets)

- Global shortcuts (remappable): show app ⌃⌘T, quick-add ⌥Space, Ramble ⇧⌥R.
- Quick-add: separate frameless transparent always-on-top 700×640 window,
  prefillable via IPC/deep link.
- Tray menu-bar item with live today-task list (per-priority icons), Add Task,
  navigation entries; `stay_in_tray` / `show_in_menu_bar` / `show_in_dock` prefs.
- Dock badge count (IPC `setBadge`), reminder notifications with actions
  (Complete / Snooze 30m / 3h / tomorrow 9:00).
- Deep links `todoist://` — endpoints incl. today, inbox, upcoming, project,
  task, openquickadd, addtask, search, navigate-to.
- Native appexes (widgets, Siri App Intents, share, Safari ext) via a custom
  N-API bridge + App Group/Keychain token — out of scope for Dash v1.

## Shell menus (native) — File/Edit/View/Window minimal; notable items

Preferences ⌘, · Open in New Window ⇧⌘N · Back/Forward ⌘[ ⌘] · Float on Top
⌥⌘F · zoom controls. In-app shortcuts (q, e, …) live in the web renderer.

## Update/telemetry

electron-updater (generic feed electron-dl.todoist.net), channels, install on
quit. Sentry + electron-log. (Dash: electron-updater via GitHub releases like
Prose; no telemetry per solo.ist rules.)
