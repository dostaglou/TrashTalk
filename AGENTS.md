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

## Commands

```sh
npm install
npm run tauri android dev
npm run tauri android build -- --apk
```
