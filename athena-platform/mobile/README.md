# ATHENA Mobile App

React Native mobile application for the ATHENA career platform.

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator

## Getting Started

1. **Install dependencies**
   ```bash
   cd mobile
   npm install
   ```

2. **Start the development server**
   ```bash
   npm start
   ```

3. **Run on your device**
   - Scan the QR code with Expo Go (iOS/Android)
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator

## Project Structure

```
mobile/
├── App.tsx                 # App entry point
├── app.json                # Expo configuration
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
└── src/
    ├── context/            # React contexts
    │   └── AuthContext.tsx # Authentication state
    ├── navigation/         # Navigation configuration
    │   └── AppNavigator.tsx
    ├── screens/            # Screen components
    │   ├── auth/
    │   │   ├── LoginScreen.tsx
    │   │   └── RegisterScreen.tsx
    │   ├── HomeScreen.tsx
    │   ├── JobsScreen.tsx
    │   ├── JobDetailScreen.tsx
    │   ├── MessagesScreen.tsx
    │   ├── NotificationsScreen.tsx
    │   └── ProfileScreen.tsx
    └── services/           # API and services
        ├── api.ts          # Axios API client
        └── socket.ts       # Socket.IO client
```

## Features

- **Authentication**: Login/Register with JWT tokens
- **Job Search**: Browse and search job listings
- **Job Details**: View full job descriptions and apply
- **Social Feed**: View and interact with posts
- **Messages**: Real-time messaging with Socket.IO
- **Notifications**: Push notification support
- **Profile**: User profile management

## Demo Credentials

Only on a database that has been seeded (`npm run db:seed` in `server/`), and
only with the password the seed used — `SEED_DEMO_PASSWORD` if it was set:

```
Email: demo@athena.com
Password: Demo123!
```

## Configuration

Nothing is configured in `app.json`. It holds the static manifest — name,
icons, permissions, deep-link hosts — and `app.config.js` adds everything that
differs between builds, from the environment:

| Variable | Required | What it does |
| --- | --- | --- |
| `API_URL` | yes | Origin of the deployed API, e.g. `https://athena-api.onrender.com`. `/api` is appended once, here, so `services/api.ts` never guesses. A build with this unset **fails**, on purpose: there used to be a default pointing at a domain ATHENA does not own, so any build made without it shipped an app that sent members' credentials to a stranger. |
| `WEB_URL` | no | The web app, for the "opens on the web" links. Defaults to the API origin with its `api.` label removed. |
| `EAS_PROJECT_ID` | for push | The Expo project UUID from `eas init`. Without it the app runs and registers no push token, and says so in the log. See [EAS-SETUP.md](./EAS-SETUP.md). |
| `APP_VARIANT` | no | `development` / `preview` / `staging` / `production`; set by the eas.json profile. |

Locally:

```bash
API_URL=http://localhost:5000 npm start
```

## Building for Production

```bash
npm install -g eas-cli
eas build --platform ios --profile production
eas build --platform android --profile production
```

`API_URL` and `EAS_PROJECT_ID` must be set in the shell EAS CLI runs in, or as
EAS project environment variables, before either of those will produce a
working binary.

**Store submission and over-the-air updates need credentials that are not in
this repository and cannot be:** read [EAS-SETUP.md](./EAS-SETUP.md), which
lists each one, where it comes from and where it goes.

## App Store Screenshots

```bash
npm run screenshots:ios
npm run screenshots:android
```

## Offline Sync

Offline actions are queued locally and flushed automatically when connectivity is restored.

## Shared code

This app does **not** import `athena-platform/shared`. That package sits above
`mobile/`, which is the EAS project root, and the repository declares no npm
workspaces, so nothing guarantees an EAS build container ever receives it — a
bundle that resolves `../shared` works on every laptop and may fail where the
binary is actually built. The two constants the app needed are mirrored in
`src/constants/shared.ts`, and `src/constants/__tests__/shared.test.ts` reads
the real shared package and fails if the mirror drifts. If the repository root
ever gains workspaces, that file can go back to re-exporting the package.

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation 6
- **State**: React Context API
- **HTTP Client**: Axios
- **Real-time**: Socket.IO Client
- **Storage**: Expo SecureStore (tokens)
- **Icons**: @expo/vector-icons (Ionicons)
