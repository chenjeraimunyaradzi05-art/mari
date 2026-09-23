import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 54 splits the old shouldShowAlert into banner and list.
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * The EAS project this build belongs to, or null when there is none.
 *
 * getExpoPushTokenAsync needs a project id to mint a token against, and it
 * throws when it has none. Neither app.json nor app.config.js used to define
 * one, so on a store build this threw on every cold start and every sign-in —
 * out of an un-awaited call, which surfaces as an unhandled promise rejection
 * rather than as anything a member or a log could act on. app.config.js now
 * reads it from EAS_PROJECT_ID (see mobile/EAS-SETUP.md; it is created by
 * `eas init` against the owner's Expo account and cannot be invented here),
 * and anything that is not the UUID EAS issues — an empty variable, a
 * placeholder left in a config — is treated as absent rather than passed on
 * to fail deeper in.
 */
const EAS_PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function easProjectId(): string | null {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  const candidate = (typeof fromConfig === 'string' ? fromConfig : typeof fromEas === 'string' ? fromEas : '').trim();
  return EAS_PROJECT_ID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * This device's Expo push token, or null when this build cannot have one —
 * because the member declined the permission, because the build has no EAS
 * project id, or because the token service could not be reached. It never
 * throws: a phone that cannot register for push is a phone that misses
 * notifications, not one that should fail to start.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const projectId = easProjectId();
  if (!projectId) {
    console.warn(
      '[push] This build has no EAS project id, so no push token can be issued and this device will receive no notifications. ' +
        'Set EAS_PROJECT_ID for the build (mobile/EAS-SETUP.md explains where it comes from).'
    );
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
      });
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    console.warn('[push] Could not register this device for notifications:', error instanceof Error ? error.message : error);
    return null;
  }
}

// The token this device registered, so sign-out can take it back.
let registeredToken: string | null = null;

/**
 * Registers this device with the server, if it can. Every caller launches
 * this without awaiting it — App.tsx at cold start, AuthContext after a sign
 * in — so nothing in it may reject: the registration itself is inside the try
 * as well as the upload, because a rejection here has nowhere to go but the
 * unhandled-rejection handler.
 */
export async function syncPushToken() {
  try {
    const token = await registerForPushNotifications();
    if (!token) return;
    await api.post('/notifications/push-token', { token, provider: 'expo', platform: Platform.OS });
    registeredToken = token;
  } catch (error) {
    // Not fatal, and not silent: the next launch or sign-in tries again, but
    // a device that never registers is a device that never hears from us, so
    // the reason is left where a bug report can pick it up.
    console.warn('[push] Could not sync this device with the server:', error instanceof Error ? error.message : error);
  }
}

/**
 * Forgets this device on the server. Called before sign-out, so the next
 * person to sign in on the phone does not receive the previous member's
 * messages.
 */
export async function unsyncPushToken() {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  try {
    await api.delete('/notifications/push-token', { data: { token } });
  } catch (error) {
    // The server also moves a token to whoever signs in next, so this is belt and braces.
  }
}
