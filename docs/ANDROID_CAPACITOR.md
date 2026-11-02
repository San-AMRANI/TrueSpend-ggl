# TrueSpend — Capacitor Android App Guide

TrueSpend is configured as a native Android application using **Capacitor** (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`).

---

## 1. Architecture Overview

- **App ID / Package Name:** `com.truespend.app`
- **App Name:** `TrueSpend`
- **Web Assets Bundle (`webDir`):** `dist/` (built with Vite)
- **Native Android Project:** `android/` (Gradle + Android Studio project)
- **Native Bridge:** `src/lib/capacitorBridge.ts`
  - Automatically detects when running inside the Capacitor Android WebView (`Capacitor.isNativePlatform()`).
  - Transparently routes relative `/api/*` `fetch()` calls from the native WebView (`https://localhost`) to the deployed Vercel API (`https://true-spend-ggl.vercel.app` by default, or any custom endpoint set via `VITE_API_BASE_URL` or in **Settings → Android / Capacitor Native Runtime**).
  - Handles the **Android hardware back button** (navigates browser history or minimizes the app at root).
  - Syncs the **Android Status Bar** and hides the native **Splash Screen** once React mounts.
  - Supports **native haptics** (`@capacitor/haptics`) and **keyboard resize behavior** (`@capacitor/keyboard`).

---

## 2. NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run cap:sync` | Builds the Vite web bundle (`dist/`) and syncs web assets + native plugins into `android/` |
| `npm run cap:open` | Opens the `android/` project in Android Studio |
| `npm run cap:run` | Builds, syncs, and runs the app on a connected Android device or emulator |
| `npm run android:apk:debug` | Builds web assets, syncs Capacitor, and compiles a Debug APK via Gradle |

---

## 3. Building the APK Locally

### Prerequisites
- **Node.js 20+**
- **JDK 21** (required by Capacitor 8 / Android Gradle Plugin)
- **Android SDK** (via Android Studio or Android Command Line Tools)

### Option A: Using Android Studio (Recommended)
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Build the web app and sync with the Android project:
   ```bash
   npm run cap:sync
   ```
3. Open in Android Studio:
   ```bash
   npm run cap:open
   ```
4. In Android Studio, click **Build → Build Bundle(s) / APK(s) → Build APK(s)** or click **Run ▶️** to launch on an emulator or physical phone.

### Option B: Command-Line Gradle Build
```bash
npm run android:apk:debug
```
The generated APK will be output to:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. Connecting the Android App to Your Backend Server

Because the Android APK bundles the frontend UI locally inside the app, all `/api/*` requests are forwarded to the TrueSpend backend server:

1. **Default Cloud Server**: Out of the box, the Android app connects to the deployed Vercel API (`https://true-spend-ggl.vercel.app`).
2. **Android Emulator (Local Backend)**: If running `npm run dev` on your computer and testing in the Android Emulator, open **Settings → Android / Capacitor Native Runtime** inside the app and set the endpoint to:
   ```
   http://10.0.2.2:3000
   ```
3. **Physical Phone on Same Wi-Fi**: Set the endpoint in **Settings → Android / Capacitor Native Runtime** to your computer's LAN IP (e.g., `http://192.168.1.50:3000`).
