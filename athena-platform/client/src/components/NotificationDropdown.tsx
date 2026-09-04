'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  X,
  Briefcase,
  MessageCircle,
  Calendar,
  AlertCircle,
  Settings,
  Check,
  CheckCheck,
  Heart,
  UserPlus,
  Award,
  Gift,
  Repeat2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore, Notification as StoreNotification } from '@/lib/stores/notification.store';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '@/lib/hooks';

const notificationIcons: Record<StoreNotification['type'], React.ElementType> = {
  JOB_MATCH: Briefcase,
  APPLICATION_UPDATE: Briefcase,
  MESSAGE: MessageCircle,
  MENTION: MessageCircle,
  SYSTEM: AlertCircle,
  MENTOR_SESSION: Calendar,
  LIKE: Heart,
  COMMENT: MessageCircle,
  FOLLOW: UserPlus,
  REPOST: Repeat2,
  ACHIEVEMENT: Award,
  LEVEL_UP: Award,
  GIFT_RECEIVED: Gift,
};

const notificationColors: Record<StoreNotification['type'], string> = {
  JOB_MATCH: 'bg-blue-100 dark:bg-blue-900/30 text-blue-500',
  APPLICATION_UPDATE: 'bg-purple-100 dark:bg-purple-900/30 text-purple-500',
  MESSAGE: 'bg-green-100 dark:bg-green-900/30 text-green-500',
  MENTION: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500',
  SYSTEM: 'bg-slate-100 dark:bg-slate-700 text-slate-500',
  MENTOR_SESSION: 'bg-orange-100 dark:bg-orange-900/30 text-orange-500',
  LIKE: 'bg-rose-100 dark:bg-rose-900/30 text-rose-500',
  COMMENT: 'bg-pink-100 dark:bg-pink-900/30 text-pink-500',
  FOLLOW: 'bg-purple-100 dark:bg-purple-900/30 text-purple-500',
  REPOST: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500',
  ACHIEVEMENT: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500',
  LEVEL_UP: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-500',
  GIFT_RECEIVED: 'bg-amber-100 dark:bg-amber-900/30 text-amber-500',
};

export default function NotificationDropdown() {
  const { notifications, unreadCount, isOpen, setNotifications, markAsRead, markAllAsRead, setPanelOpen, togglePanel, removeNotification } = useNotificationStore();
  const { data: apiNotifications } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markManyRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (apiNotifications?.notifications) {
      const mapped = apiNotifications.notifications.map((n: any) => {
        const rawType = String(n.type || 'SYSTEM').toUpperCase();
        const normalizedType = (rawType in notificationIcons
          ? rawType
          : 'SYSTEM') as StoreNotification['type'];

        return {
          id: n.id,
          type: normalizedType,
          title: n.title,
          message: n.message,
          link: n.link || undefined,
          isRead: typeof n.isRead === 'boolean' ? n.isRead : Boolean(n.readAt),
          createdAt: n.createdAt,
          ids: Array.isArray(n.ids) ? n.ids : undefined,
          count: typeof n.count === 'number' ? n.count : undefined,
        };
      });
      setNotifications(mapped);
    }
  }, [apiNotifications, setNotifications]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={togglePanel}
        className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    markAllAsRead();
                    markAllRead.mutate();
                  }}
                  className="text-sm text-primary-500 hover:text-primary-600 flex items-center"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <Link
                href="/dashboard/settings/notifications"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title="Notification settings"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400">
                  No notifications yet
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  We'll notify you when something happens
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type] || AlertCircle;
                  const colorClass = notificationColors[notification.type] || notificationColors.SYSTEM;

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'relative group px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition',
                        !notification.isRead && 'bg-primary-50/50 dark:bg-primary-900/10'
                      )}
                    >
                      <Link
                        href={notification.link || '#'}
                        onClick={() => {
                          markAsRead(notification.id);
                          if (notification.ids && notification.ids.length > 1) {
                            markManyRead.mutate(notification.ids);
                          } else {
                            markRead.mutate(notification.id);
                          }
                          setPanelOpen(false);
                        }}
                        className="flex items-start space-x-3"
                      >
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                            colorClass
                          )}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </Link>

                      {/* Actions */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center space-x-1">
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                              if (notification.ids && notification.ids.length > 1) {
                                markManyRead.mutate(notification.ids);
                              } else {
                                markRead.mutate(notification.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                            deleteNotification.mutate(notification.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
              <Link
                href="/dashboard/notifications"
                onClick={() => setPanelOpen(false)}
                className="block w-full text-center text-sm text-primary-500 hover:text-primary-600 font-medium"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
