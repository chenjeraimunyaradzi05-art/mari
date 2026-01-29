/**
 * Notifications Hooks
 * Phase 5: Mobile Parity - React Query hooks for push notifications
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNotificationsStore, type NotificationPreferences } from '../stores';
import { api } from '../services/api';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ============================================
// QUERY KEYS
// ============================================

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

// ============================================
// PERMISSION HELPERS
// ============================================

export async function requestPushPermissions(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  
  if (existingStatus === 'granted') {
    return 'granted';
  }
  
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export async function getPushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID,
    });
    return token.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

// ============================================
// HOOKS
// ============================================

/**
 * Get all notifications
 */
export function useNotifications() {
  const { setNotifications, setLoading } = useNotificationsStore();

  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      setLoading(true);
      const response = await api.get('/notifications');
      return response.data;
    },
    onSuccess: (data) => {
      setNotifications(data);
    },
    onSettled: () => {
      setLoading(false);
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get unread count
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async () => {
      const response = await api.get('/notifications/unread-count');
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Mark notification as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { markAsRead: markAsReadLocal } = useNotificationsStore();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/notifications/${notificationId}/read`);
      return notificationId;
    },
    onMutate: (notificationId) => {
      markAsReadLocal(notificationId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { markAllAsRead: markAllAsReadLocal } = useNotificationsStore();

  return useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all');
    },
    onMutate: () => {
      markAllAsReadLocal();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
  });
}

/**
 * Delete notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { removeNotification } = useNotificationsStore();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.delete(`/notifications/${notificationId}`);
      return notificationId;
    },
    onMutate: (notificationId) => {
      removeNotification(notificationId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

/**
 * Archive notification
 */
export function useArchiveNotification() {
  const queryClient = useQueryClient();
  const { archiveNotification: archiveNotificationLocal } = useNotificationsStore();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/notifications/${notificationId}/archive`);
      return notificationId;
    },
    onMutate: (notificationId) => {
      archiveNotificationLocal(notificationId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

/**
 * Get notification preferences
 */
export function useNotificationPreferences() {
  const { setPreferences } = useNotificationsStore();

  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: async () => {
      const response = await api.get('/notifications/preferences');
      return response.data;
    },
    onSuccess: (data) => {
      setPreferences(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Update notification preferences
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const { setPreferences, preferences } = useNotificationsStore();

  return useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      const response = await api.put('/notifications/preferences', newPreferences);
      return response.data;
    },
    onMutate: async (newPreferences) => {
      // Optimistic update
      const previousPreferences = { ...preferences };
      setPreferences(newPreferences);
      return { previousPreferences };
    },
    onError: (err, newPreferences, context) => {
      // Rollback
      if (context?.previousPreferences) {
        setPreferences(context.previousPreferences);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}

/**
 * Register push token with server
 */
export function useRegisterPushToken() {
  const { setPushToken, setPermissionStatus } = useNotificationsStore();

  return useMutation({
    mutationFn: async () => {
      // Request permission
      const status = await requestPushPermissions();
      setPermissionStatus(status);

      if (status !== 'granted') {
        throw new Error('Push notification permission denied');
      }

      // Get push token
      const token = await getPushToken();
      if (!token) {
        throw new Error('Failed to get push token');
      }

      // Register with server
      await api.post('/notifications/register-device', {
        token,
        platform: Platform.OS,
        deviceId: `${Platform.OS}-${Date.now()}`, // Should use a proper device ID
      });

      return token;
    },
    onSuccess: (token) => {
      setPushToken(token);
    },
  });
}

/**
 * Unregister push token (logout)
 */
export function useUnregisterPushToken() {
  const { setPushToken } = useNotificationsStore();

  return useMutation({
    mutationFn: async (token: string) => {
      await api.delete('/notifications/unregister-device', {
        data: { token },
      });
    },
    onSuccess: () => {
      setPushToken('');
    },
  });
}

/**
 * Test push notification
 */
export function useTestPushNotification() {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/notifications/test');
      return response.data;
    },
  });
}

/**
 * Handle notification action (when user taps on notification)
 */
export function useHandleNotificationAction() {
  const queryClient = useQueryClient();
  const { markAsRead } = useNotificationsStore();

  return useMutation({
    mutationFn: async ({
      notificationId,
      actionId,
    }: {
      notificationId: string;
      actionId?: string;
    }) => {
      const response = await api.post(`/notifications/${notificationId}/action`, {
        actionId,
      });
      return response.data;
    },
    onSuccess: (_, { notificationId }) => {
      markAsRead(notificationId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

/**
 * Schedule local notification
 */
export async function scheduleLocalNotification({
  title,
  body,
  data,
  trigger,
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
  trigger?: Notifications.NotificationTriggerInput;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: trigger || null, // null = immediate
  });
}

/**
 * Cancel scheduled notification
 */
export async function cancelScheduledNotification(identifier: string) {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear all delivered notifications
 */
export async function clearAllDeliveredNotifications() {
  await Notifications.dismissAllNotificationsAsync();
}
