# Mobile App Build Guide (ATHENA)

## Overview
The ATHENA mobile app is built with Expo/React Native and deployed using EAS Build.

**Important**: Mobile apps CANNOT be deployed on Railway or Netlify. They require:
- **EAS Build** for building APK/IPA files
- **App Store** for iOS distribution  
- **Google Play Store** for Android distribution

## Prerequisites

1. **Expo Account**: Create at https://expo.dev
2. **EAS CLI**: `npm install -g eas-cli`
3. **Apple Developer Account** (for iOS): $99/year
4. **Google Play Developer Account** (for Android): $25 one-time

## Quick Start

### Step 1: Login to EAS
```bash
cd athena-platform/mobile
eas login
```

### Step 2: Configure Project
```bash
eas build:configure
```

### Step 3: Build for Preview/Testing
```bash
# Build for both platforms (internal testing)
eas build --platform all --profile preview

# Build Android APK only
eas build --platform android --profile preview

# Build iOS Simulator
eas build --platform ios --profile preview
```

### Step 4: Build for Production
```bash
# Production build (requires store credentials)
eas build --platform all --profile production
```

## Build Profiles

| Profile | Purpose | Distribution |
|---------|---------|--------------|
| `development` | Dev builds with hot reload | Internal (requires dev client) |
| `preview` | Testing builds | Internal (APK/Simulator) |
| `staging` | Pre-production | Internal testing track |
| `production` | Store release | App Store / Google Play |

## GitHub Actions (Automated Builds)

The workflow at `.github/workflows/mobile-build.yml` handles automated builds.

### Required Secrets
Add these to GitHub → Repository → Settings → Secrets:

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Get from https://expo.dev/accounts/[your-account]/settings/access-tokens |

### Trigger Build Manually
1. Go to Actions tab in GitHub
2. Select "Mobile App Build (EAS)"
3. Click "Run workflow"
4. Choose platform and profile

## iOS Specific Setup

### 1. Apple Developer Certificates
```bash
# EAS manages certificates automatically
eas credentials
```

### 2. Update eas.json with Apple IDs
Edit `athena-platform/mobile/eas.json`:
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-apple-id@email.com",
      "ascAppId": "1234567890",  // App Store Connect App ID
      "appleTeamId": "ABCD1234"   // Apple Team ID
    }
  }
}
```

### 3. Submit to App Store
```bash
eas submit --platform ios --latest
```

## Android Specific Setup

### 1. Create Google Service Account
1. Go to Google Play Console → Setup → API access
2. Create a service account
3. Download the JSON key file
4. Save as `athena-platform/mobile/google-service-account.json`
5. **Add to .gitignore** (never commit this file!)

### 2. Update eas.json
```json
"submit": {
  "production": {
    "android": {
      "track": "production",
      "serviceAccountKeyPath": "./google-service-account.json"
    }
  }
}
```

### 3. Submit to Google Play
```bash
eas submit --platform android --latest
```

## Environment Variables

Set in `eas.json` under each profile's `env` section:

| Variable | Description |
|----------|-------------|
| `API_URL` | Backend API URL (Railway) |
| `APP_VARIANT` | development/preview/staging/production |

For sensitive values, use EAS Secrets:
```bash
eas secret:create --name API_KEY --value "your-api-key" --scope project
```

## Testing Builds

### Internal Distribution (Preview)
1. Build: `eas build --platform all --profile preview`
2. Get download link from EAS dashboard
3. Share with testers

### TestFlight (iOS)
1. Build: `eas build --platform ios --profile staging`
2. Submit: `eas submit --platform ios`
3. Manage testers in App Store Connect

### Google Play Internal Testing
1. Build: `eas build --platform android --profile staging`
2. Submit: `eas submit --platform android`
3. Manage testers in Google Play Console

## Troubleshooting

### Build Failing
- Check EAS build logs at https://expo.dev
- Verify Expo SDK version compatibility
- Ensure all native dependencies are supported

### iOS Code Signing Issues
```bash
# Reset iOS credentials
eas credentials --platform ios
# Choose "Remove" then let EAS regenerate
```

### Android Keystore Issues
```bash
# View Android credentials
eas credentials --platform android
```

### Cannot Install on Device
- For iOS: Device must be registered in Apple Developer Account
- For Android: Enable "Install from unknown sources"

## Project Structure

```
athena-platform/mobile/
├── app.json           # Expo app configuration
├── eas.json           # EAS Build configuration
├── App.tsx            # App entry point
├── src/
│   ├── screens/       # Screen components
│   ├── components/    # Reusable components
│   ├── navigation/    # React Navigation setup
│   └── services/      # API services
├── assets/            # Images, fonts
└── package.json       # Dependencies
```

## Useful Commands

```bash
# Start development server
npm start

# Run on iOS Simulator
npm run ios

# Run on Android Emulator
npm run android

# Run Expo web
npm run web

# View build status
eas build:list

# View credentials
eas credentials

# Update OTA (Over-the-Air)
eas update --branch preview --message "Bug fixes"
```

## Cost Considerations

| Service | Cost |
|---------|------|
| EAS Build (Free) | 30 builds/month |
| EAS Build (Production) | $99/month (unlimited) |
| Apple Developer | $99/year |
| Google Play | $25 one-time |
