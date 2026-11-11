# Pomodoro Logs

A standalone retro pixel desktop timer with an animated tomato, progress meter, chiptune completion sound, and direct Obsidian Markdown logging.

## Timer and logs

- Work / short break / long break defaults: **25 / 5 / 15 minutes**. SETUP accepts 1–180 minutes per interval.
- Start, pause/resume, reset, or select a different interval. Ctrl/Cmd+Enter starts or pauses. Selecting another interval or resetting discards the current unfinished interval.
- Every fourth completed focus session prepares a long break; other focus sessions prepare a short break. Breaks prepare the next focus session. Intervals do not start automatically.
- Pick/type a tag and mission note **before** starting. Only completed focus sessions write logs.
- Sound is optional and enabled by default. The sound button mutes/unmutes and persists the preference. Clicking Start unlocks the local audio engine. Completion also requests a desktop notification, subject to the OS's notification settings.
- Active timers use a wall-clock deadline and persist across reloads/restarts. Pause stores the remaining time. A deadline that expires while sleeping or closed is handled when the app next opens; desktop notifications require a running renderer window.

Default output: `Pomodoro Logs/YYYY-MM-DD.md`, using the local calendar date:

```markdown
- [x] 14:30 - 14:55 | **Duration:** 25m | **Type:** #coding | **Notes:** Built pixel timer UI [duration:: 25] [type:: coding] <!-- quiet:unique-session-id -->
```

The invisible session marker deduplicates recovered or retried sessions. Existing note content is preserved and new entries append. Pending sessions persist in app storage; connect a vault or use **RETRY LOG(S)** after a temporary write failure. Pending sessions sync to the currently configured vault. Do not clear app data while logs are pending.

Changing durations applies immediately to an idle timer; reset a paused/active timer to use new durations. Notifications and chiptunes fire for all interval completions, while only work sessions are logged.

The workflow is `.github/workflows/build-mac-pomodoro.yml`. Vite's development port is **5173**.

Tests cover Markdown append preservation/idempotency, safe paths/config persistence, wall-clock pause/resume, and every-fourth-session long breaks. The Electron smoke test also verifies start/pause/reset, short/long selection, mute, actual completion logging, and restart deduplication.

## Linux setup

Requires Node.js **22.12+** (24 LTS recommended) and a graphical Linux desktop. On Ubuntu/Debian, Electron commonly needs `libgtk-3-0`, `libnss3`, `libgbm1`, `libatk-bridge2.0-0`, and `libasound2t64` (`libasound2` on older releases).

From this project directory:

```bash
npm ci
./run-linux.sh
```

For hot reload: `npm run dev`. The launcher checks Node's version, builds, and opens the desktop app. Electron downloads its development runtime on first use. Run as your normal desktop user with the sandbox enabled.

## Obsidian connection

Open **SETUP [+] → CHOOSE FOLDER...**, select the existing vault, adjust the relative subfolder if needed, and click **SAVE SETTINGS**. Canceling the settings window leaves the configuration unchanged. The directory picker is native; Markdown files are written directly, with no Obsidian plugin or cloud service. The application keeps its own config under Electron's per-user `userData/config.json` directory.

The bridge rejects `..`, absolute subfolders, escaping directory symlinks, and symlink notes. IPC is restricted to the app's main frame, Node integration is disabled in the renderer, context isolation and the sandbox are enabled, and only local app assets load.

## Check and package

```bash
npm run lint
npm test
npm run build
npm run package:linux
```

`lint` runs strict TypeScript and backend syntax checks. `test` runs four focused tests using temporary directories. The Linux package command produces an AppImage under `release/`; some distributions require FUSE to open AppImages. `./run-linux.sh` runs without an AppImage.

Optional Linux desktop smoke test (requires Xvfb or a desktop display):

```bash
npm install --no-save --package-lock=false playwright
xvfb-run -a node tests/electron-smoke.cjs
```

The test uses a temporary app profile and vault. It stubs only the native directory dialog's selection; the rest of the flow uses the actual renderer, IPC, and disk writes. In a restricted CI container that cannot support Chromium's sandbox, set `PIXEL_TEST_NO_SANDBOX=1` for this test only. Optional `PIXEL_SCREENSHOT_DIR=/absolute/output/directory` saves screenshots.

## macOS workflow

Publish **this directory as its own repository root**, including `.github` and `package-lock.json`. No sibling project or shared workspace is needed. The workflow runs on every push or manual dispatch using `macos-latest`, tests/builds, and uploads separate **arm64 (Apple Silicon)** and **x64 (Intel)** DMG and ZIP artifacts. Download them from the GitHub Actions run. ZIPs contain the `.app` bundles.

Bundles are **unsigned**. Apple Developer signing and notarization credentials are not configured. Gatekeeper may require explicit approval for an unsigned download. macOS packaging runs remotely; development on Linux uses no Swift, Xcode, or macOS-only APIs.

## Assets and independence

The VT323 pixel font is bundled locally, including its SIL Open Font License in `src/assets/OFL.txt` and `public/VT323-OFL.txt` (copied into the built app). Source: [Google Fonts VT323](https://github.com/google/fonts/tree/main/ofl/vt323). Graphics and sounds are generated locally from code; no remote assets are requested. Reduced-motion preferences disable animation.

This is a self-contained Electron + React + TypeScript project, with its own package lock, app identity, settings, preload API, filesystem bridge, assets, tests, and workflow. It imports nothing from the other productivity app.

## Verification

Verified locally on Linux: strict type/syntax checks, production build, all four focused tests, and a real Electron/Xvfb smoke test with zero renderer errors. Smoke testing covered bundled-font loading, settings persistence through the folder-picker bridge, and Markdown writes. macOS workflows are configured but have not run remotely in this session.

The locked electron-builder packaging toolchain has six moderate dependency advisories from the dependency audit. Review `npm audit` when updating packaging dependencies.
