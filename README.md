# TrashTalk

Android-only, fully offline trash-schedule application built with Tauri 2, Rust, Vite, and vanilla JavaScript.

## Development

```sh
npm install
npm run tauri android init
npm run tauri android dev
```

Connect an Android device with USB debugging enabled, or start an Android emulator, before running the last command.

## Build

```sh
npm run tauri android build -- --apk
```

The APK is written under `src-tauri/gen/android/app/build/outputs/apk/`.
