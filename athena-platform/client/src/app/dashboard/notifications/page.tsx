'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Briefcase,
  MessageCircle,
  Heart,
  UserPlus,
  Calendar,
  Award,
  AlertCircle,
  Settings,
  Gift,
} from 'lucide-react';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '@/lib/hooks';
import { cn } from '@/lib/utils';

type NotificationType =
  | 'JOB_MATCH'
  | 'APPLICATION_UPDATE'
  | 'MESSAGE'
  | 'MENTION'
  | 'SYSTEM'
  | 'MENTOR_SESSION'
  | 'LIKE'
  | 'COMMENT'
  | 'FOLLOW'
  | 'ACHIEVEMENT'
  | 'LEVEL_UP'
  | 'GIFT_RECEIVED';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

const notificationIcons: Record<NotificationType, React.ElementType> = {
  JOB_MATCH: Briefcase,
  APPLICATION_UPDATE: Briefcase,
  MESSAGE: MessageCircle,
  MENTION: MessageCircle,
  SYSTEM: AlertCircle,
  MENTOR_SESSION: Calendar,
  LIKE: Heart,
  COMMENT: MessageCircle,
  FOLLOW: UserPlus,
  ACHIEVEMENT: Award,
  LEVEL_UP: Award,
  GIFT_RECEIVED: Gift,
};

const notificationColors: Record<NotificationType, string> = {
  JOB_MATCH: 'bg-blue-100 dark:bg-blue-900/30 text-blue-500',
  APPLICATION_UPDATE: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500',
  MESSAGE: 'bg-green-100 dark:bg-green-900/30 text-green-500',
  MENTION: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500',
  SYSTEM: 'bg-slate-100 dark:bg-slate-700 text-slate-500',
  MENTOR_SESSION: 'bg-orange-100 dark:bg-orange-900/30 text-orange-500',
  LIKE: 'bg-red-100 dark:bg-red-900/30 text-red-500',
  COMMENT: 'bg-pink-100 dark:bg-pink-900/30 text-pink-500',
  FOLLOW: 'bg-purple-100 dark:bg-purple-900/30 text-purple-500',
  ACHIEVEMENT: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500',
  LEVEL_UP: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-500',
  GIFT_RECEIVED: 'bg-amber-100 dark:bg-amber-900/30 text-amber-500',
};

const filterOptions = [
  { value: 'all', label: 'All Notifications' },
  { value: 'unread', label: 'Unread Only' },
  { value: 'JOB_MATCH', label: 'Job Matches' },
  { value: 'APPLICATION_UPDATE', label: 'Applications' },
  { value: 'MESSAGE', label: 'Messages' },
  { value: 'MENTOR_SESSION', label: 'Mentoring' },
  { value: 'LIKE', label: 'Likes' },
  { value: 'COMMENT', label: 'Comments' },
  { value: 'FOLLOW', label: 'Followers' },
  { value: 'ACHIEVEMENT', label: 'Achievements' },
  { value: 'SYSTEM', label: 'System' },
];

function normalizeType(rawType: unknown): NotificationType {
  const value = String(rawType || 'SYSTEM').toUpperCase();
  return value in notificationIcons ? (value as NotificationType) : 'SYSTEM';
}

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications({ limit: 100 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const notifications: NotificationItem[] = (data?.notifications || []).map((notification: any) => ({
    id: notification.id,
    type: normalizeType(notification.type),
    title: notification.title || 'Notification',
    message: notification.message || 'There is an update on your account.',
    isRead:
      typeof notification.isRead === 'boolean'
        ? notification.isRead
        : Boolean(notification.readAt),
    createdAt: notification.createdAt,
    link: notification.link || undefined,
  }));

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.isRead;
    return notification.type === filter;
  });

  const groupedNotifications = filteredNotifications.reduce(
    (groups, notification) => {
      const key = notification.createdAt.slice(0, 10);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notification);
      return groups;
    },
    {} as Record<string, NotificationItem[]>
  );

  const hasBulkSelection = selectedIds.length > 0;
  const hasPendingMutation =
    markRead.isPending || markAllRead.isPending || deleteNotification.isPending;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredNotifications.map((notification) => notification.id));
  };

  const markSelectedAsRead = async () => {
    await Promise.all(selectedIds.map((id) => markRead.mutateAsync(id)));
    setSelectedIds([]);
  };

  const deleteSelected = async () => {
    await Promise.all(selectedIds.map((id) => deleteNotification.mutateAsync(id)));
    setSelectedIds([]);
  };

  const handleMarkAllAsRead = () => {
    markAllRead.mutate();
    setSelectedIds([]);
  };

  const handleMarkAsRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteNotification.mutate(id);
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-20 rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
            <Bell className="w-6 h-6 mr-2 text-primary-500" />
            Notifications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notifications`
              : "You're all caught up!"}
          </p>
        </div>
        <Link
          href="/dashboard/settings/notifications"
          className="btn-outline flex items-center space-x-2"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-4 shadow dark:bg-slate-800">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={
                filteredNotifications.length > 0 &&
                selectedIds.length === filteredNotifications.length
              }
              onChange={selectAll}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {hasBulkSelection ? `${selectedIds.length} selected` : 'Select all'}
            </span>
          </label>

          {hasBulkSelection && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => void markSelectedAsRead()}
                disabled={hasPendingMutation}
                className="flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm text-primary-500 transition hover:bg-primary-50 disabled:opacity-50 dark:hover:bg-primary-900/20"
              >
                <Check className="w-4 h-4" />
                <span>Mark as read</span>
              </button>
              <button
                onClick={() => void deleteSelected()}
                disabled={hasPendingMutation}
                className="flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className="flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Filter className="w-4 h-4" />
              <span>{filterOptions.find((option) => option.value === filter)?.label}</span>
            </button>

            {showFilters && (
              <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFilter(option.value);
                      setShowFilters(false);
                      setSelectedIds([]);
                    }}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700',
                      filter === option.value
                        ? 'bg-primary-50 text-primary-500 dark:bg-primary-900/20'
                        : 'text-slate-700 dark:text-slate-300'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={hasPendingMutation}
              className="flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm text-primary-500 transition hover:bg-primary-50 disabled:opacity-50 dark:hover:bg-primary-900/20"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="card py-16 text-center">
          <Bell className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-600" />
          <h3 className="mb-2 text-lg font-medium text-slate-900 dark:text-white">
            No notifications
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {filter === 'all'
              ? "You don't have any notifications yet"
              : `No ${filterOptions
                  .find((option) => option.value === filter)
                  ?.label.toLowerCase()} to show`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([date, group]) => (
            <div key={date}>
              <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                {date}
              </h3>
              <div className="space-y-2">
                {group.map((notification) => {
                  const Icon = notificationIcons[notification.type];
                  const colorClass = notificationColors[notification.type];

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'group relative rounded-lg bg-white p-4 shadow transition hover:shadow-md dark:bg-slate-800',
                        !notification.isRead && 'ring-2 ring-primary-500/20'
                      )}
                    >
                      <div className="flex items-start space-x-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(notification.id)}
                          onChange={() => toggleSelect(notification.id)}
                          className="mt-1 rounded border-slate-300 dark:border-slate-600"
                        />

                        <div
                          className={cn(
                            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                            colorClass
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <Link
                          href={notification.link || '/dashboard/notifications'}
                          onClick={() => {
                            if (!notification.isRead) {
                              handleMarkAsRead(notification.id);
                            }
                          }}
                          className="min-w-0 flex-1"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {notification.title}
                                {!notification.isRead && (
                                  <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary-500" />
                                )}
                              </p>
                              <p className="mt-1 text-slate-600 dark:text-slate-300">
                                {notification.message}
                              </p>
                              <p
                                className="mt-2 text-sm text-slate-400 dark:text-slate-500"
                                suppressHydrationWarning
                              >
                                {isHydrated
                                  ? formatDistanceToNow(new Date(notification.createdAt), {
                                      addSuffix: true,
                                    })
                                  : notification.createdAt.slice(0, 10)}
                              </p>
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center space-x-1 opacity-0 transition group-hover:opacity-100">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              disabled={hasPendingMutation}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-primary-500 disabled:opacity-50 dark:hover:bg-slate-700"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification.id)}
                            disabled={hasPendingMutation}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-red-500 disabled:opacity-50 dark:hover:bg-slate-700"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
