# TrashTalk contributor guide

## Stack

- Android-only application using stable Rust and Tauri 2.
- Frontend: Vite, npm, vanilla JavaScript, HTML, and plain CSS.
- Native code is in `src-tauri`; frontend source is in `src`.

## Architectural constraints

- TrashTalk must work completely offline. Do not add a server, authentication, accounts, analytics, telemetry, remote configuration, or runtime network dependencies.
- Do not add TypeScript or a frontend framework (React, Vue, Svelte, etc.) unless the project requirements explicitly change.
- Keep the Android target as the supported platform. Do not add desktop or iOS product features.
- Prefer local, inspectable data storage and deterministic behavior.
- Keep permissions and Tauri capabilities minimal; add only those required by an implemented feature.

## Application architecture

- Keep domain rules and date calculations in Rust; the frontend is presentation-only and requests application-level data through Tauri commands.
- Persist application state as versioned JSON behind a Rust repository abstraction. Do not let frontend code access the state file directly.
- Seed default CollectionTypes in application state using stable IDs. Future custom CollectionTypes use the same model with `is_system: false`.
- Preserve the local-first design: no server or network dependencies.
- `../TrashIt` is read-only and may be used only as a UI/UX reference, not as an architecture source.
- Recurrence semantics and schedule validation belong in Rust. JavaScript renders Rust-provided descriptions and never interprets persisted recurrence rules.
- Schedule CRUD must use application-level Tauri commands and the versioned JSON repository. Deleting a Schedule never deletes its CollectionTypes.
- Calendar occurrences are derived at request time and are never persisted. Rust owns date-range and recurrence calculations; JavaScript only renders returned calendar days.
- Calendar views consume the same recurrence engine as Home and use local calendar dates without unnecessary UTC conversion.
- Notification settings are persisted in versioned AppState using strongly typed Rust enums. Existing state must be migrated forward safely.
- Notification planning is pure Rust: it derives disposable 30-day local reminders from schedules, CollectionTypes, settings, and an explicit local date/time. It must not call Tauri or Android APIs.
- Android notification registration is a single reconciliation bridge: cancel prior TrashTalk reminders, request a fresh Rust plan, and register it. Generated notification occurrences are not domain data or the source of truth.
- Request Android notification permission only after the user enables reminders or otherwise explicitly initiates notification functionality. Do not use remote push, Firebase, exact-alarm permission, or a continuously running background service.
- The shared app shell owns primary-destination navigation. Preserve visible navigation controls and keep swipe navigation bounded, clearly horizontal, and non-interfering with vertical scrolling or interactive child controls.
- Keep the canonical TrashTalk mark as a source SVG in `src/assets`; use it for the in-app brand and regenerate Android launcher resources with `npm run tauri icon -- src/assets/trashtalk-mark.svg -o src-tauri/icons`.
- Android uses edge-to-edge system bars: extend the dark brand header behind the transparent status bar, rely on safe-area insets for content placement, use light status icons there, and retain dark navigation icons over the light bottom surface.

## Commands

```sh
npm install
npm run tauri android dev
npm run tauri android build -- --apk
```
