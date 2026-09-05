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

export async function registerForPushNotifications() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

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
}

// The token this device registered, so sign-out can take it back.
let registeredToken: string | null = null;

export async function syncPushToken() {
  const token = await registerForPushNotifications();
  if (!token) return;

  try {
    await api.post('/notifications/push-token', { token, provider: 'expo', platform: Platform.OS });
    registeredToken = token;
  } catch (error) {
    // Silently fail; token sync can retry later
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
