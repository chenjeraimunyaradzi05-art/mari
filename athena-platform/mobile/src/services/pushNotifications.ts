import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
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
 * Where this phone keeps the key that proves it is the device behind its push
 * token. The server issues it on the first registration and asks for it
 * before it will move the device from one account to another: knowing a
 * member's push token used to be enough to take her phone's notifications
 * onto another account. It belongs to the phone, not to whoever is signed in,
 * so sign-out leaves it where it is — the next member to sign in on this
 * phone needs it to take the notifications over.
 */
export const DEVICE_KEY_STORE = 'athena_push_device_key';

async function storedDeviceKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DEVICE_KEY_STORE);
  } catch {
    return null;
  }
}

function isHeldByAnotherAccount(error: unknown): boolean {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
  return status === 409;
}

async function registerThisDevice(): Promise<void> {
  try {
    const token = await registerForPushNotifications();
    if (!token) return;
    const deviceKey = await storedDeviceKey();
    const response = await api.post('/notifications/push-token', {
      token,
      provider: 'expo',
      platform: Platform.OS,
      ...(deviceKey ? { deviceKey } : {}),
    });
    registeredToken = token;
    // Handed back only when the server has just issued one. Losing it would
    // cost nothing today and would cost the next member on this phone her
    // notifications, so a store that refuses it is worth a line in the log.
    const issued = (response?.data as { data?: { deviceKey?: unknown } } | undefined)?.data?.deviceKey;
    if (typeof issued === 'string' && issued) {
      await SecureStore.setItemAsync(DEVICE_KEY_STORE, issued).catch((error: unknown) => {
        console.warn('[push] Could not keep this device’s key:', error instanceof Error ? error.message : error);
      });
    }
  } catch (error) {
    if (isHeldByAnotherAccount(error)) {
      // The server would not move this phone off the account that holds it,
      // because this app could not prove it is the same phone. That is the
      // guard doing its job, so it is a warning and not an error, but it
      // means this member hears nothing here until that account signs out.
      console.warn('[push] This phone is registered for notifications on another ATHENA account, so this account will not receive them here.');
      return;
    }
    // Not fatal, and not silent: the next launch or sign-in tries again, but
    // a device that never registers is a device that never hears from us, so
    // the reason is left where a bug report can pick it up.
    console.warn('[push] Could not sync this device with the server:', error instanceof Error ? error.message : error);
  }
}

// Registrations run one after another, never side by side.
//
// A cold start that ended in a sign-in used to register twice at once — once
// from App.tsx on mount and once from AuthContext after the sign-in — and the
// two raced on the server: both found no row for the token and both wrote
// one, so the phone had two rows and every notification buzzed twice. After a
// handover only one of the two moved to the new member and the other stayed
// active under the old one. App.tsx no longer registers at all; this keeps a
// second caller from ever overlapping the first, and the second one then
// presents the key the first was issued.
let registrationChain: Promise<void> = Promise.resolve();

/**
 * Registers this device with the server, if it can. AuthContext launches this
 * without awaiting it whenever a session starts — restored at launch, or a
 * fresh sign-in — so nothing in it may reject: the registration itself is
 * inside the try as well as the upload, because a rejection here has nowhere
 * to go but the unhandled-rejection handler.
 */
export function syncPushToken(): Promise<void> {
  registrationChain = registrationChain.then(registerThisDevice, registerThisDevice);
  return registrationChain;
}

/**
 * Forgets this device on the server. Called before sign-out, so the next
 * person to sign in on the phone does not receive the previous member's
 * messages.
 */
export async function unsyncPushToken() {
  // A registration still on its way would otherwise land after this and
  // leave the phone registered to the member who has just signed out.
  await registrationChain;
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  try {
    await api.delete('/notifications/push-token', { data: { token } });
  } catch (error) {
    // The server also moves the device to whoever signs in next on this
    // phone, which presents this phone's key, so this is belt and braces.
  }
}
