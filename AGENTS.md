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

## Commands

```sh
npm install
npm run tauri android dev
npm run tauri android build -- --apk
```
