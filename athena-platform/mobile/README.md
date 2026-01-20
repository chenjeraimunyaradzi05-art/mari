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

```
Email: demo@athena.com
Password: Demo123!
```

## Configuration

Update `app.json` to configure:
- API URL: `expo.extra.apiUrl`
- Project ID for EAS builds

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## App Store Screenshots

```bash
npm run screenshots:ios
npm run screenshots:android
```

## Offline Sync

Offline actions are queued locally and flushed automatically when connectivity is restored.

## Environment Variables

For production builds, configure in `app.json` or use EAS secrets:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.athena.com"
    }
  }
}
```

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation 6
- **State**: React Context API
- **HTTP Client**: Axios
- **Real-time**: Socket.IO Client
- **Storage**: Expo SecureStore (tokens)
- **Icons**: @expo/vector-icons (Ionicons)
