'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const notificationIcons: Record<string, React.ElementType> = {
  job_match: Briefcase,
  message: MessageCircle,
  like: Heart,
  follow: UserPlus,
  mention: MessageCircle,
  event: Calendar,
  achievement: Award,
  system: AlertCircle,
};

const notificationColors: Record<string, string> = {
  job_match: 'bg-blue-100 dark:bg-blue-900/30 text-blue-500',
  message: 'bg-green-100 dark:bg-green-900/30 text-green-500',
  like: 'bg-red-100 dark:bg-red-900/30 text-red-500',
  follow: 'bg-purple-100 dark:bg-purple-900/30 text-purple-500',
  mention: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500',
  event: 'bg-orange-100 dark:bg-orange-900/30 text-orange-500',
  achievement: 'bg-pink-100 dark:bg-pink-900/30 text-pink-500',
  system: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

// Extended mock data
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'job_match',
    title: 'New Job Match',
    message: 'Senior Product Manager at Google matches your profile with 95% compatibility. This role offers competitive salary and great benefits.',
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    link: '/dashboard/jobs/1',
  },
  {
    id: '2',
    type: 'message',
    title: 'New Message',
    message: 'Sarah Chen sent you a message: "Hi! I\'d love to discuss the mentoring program with you..."',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
    link: '/dashboard/messages',
  },
  {
    id: '3',
    type: 'like',
    title: 'Post Liked',
    message: '15 people liked your post about interview tips including Maria, Jessica, and 13 others',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    link: '/dashboard/community',
  },
  {
    id: '4',
    type: 'follow',
    title: 'New Follower',
    message: 'Emily Johnson is now following you. Emily is a Senior Engineer at Meta.',
    isRead: true,
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    link: '/dashboard/profile/emily',
  },
  {
    id: '5',
    type: 'achievement',
    title: 'Achievement Unlocked!',
    message: 'Congratulations! You earned the "Community Champion" badge for helping 10 women with career advice.',
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    link: '/dashboard/settings/profile',
  },
  {
    id: '6',
    type: 'event',
    title: 'Upcoming Event',
    message: 'Reminder: "Women in Tech Leadership Panel" starts in 2 hours. Don\'t forget to join!',
    isRead: true,
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    link: '/dashboard/events/1',
  },
  {
    id: '7',
    type: 'job_match',
    title: 'Application Update',
    message: 'Your application for "Engineering Manager at Stripe" has moved to the interview stage!',
    isRead: true,
    createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    link: '/dashboard/applications',
  },
  {
    id: '8',
    type: 'system',
    title: 'Profile Strength',
    message: 'Your profile is 85% complete. Add your portfolio to increase visibility to employers.',
    isRead: true,
    createdAt: new Date(Date.now() - 96 * 3600000).toISOString(),
    link: '/dashboard/settings/profile',
  },
  {
    id: '9',
    type: 'mention',
    title: 'You were mentioned',
    message: 'Lisa Park mentioned you in a comment: "@jane Great advice on negotiation strategies!"',
    isRead: true,
    createdAt: new Date(Date.now() - 120 * 3600000).toISOString(),
    link: '/dashboard/community',
  },
];

const filterOptions = [
  { value: 'all', label: 'All Notifications' },
  { value: 'unread', label: 'Unread Only' },
  { value: 'job_match', label: 'Job Matches' },
  { value: 'message', label: 'Messages' },
  { value: 'like', label: 'Likes & Reactions' },
  { value: 'follow', label: 'Followers' },
  { value: 'event', label: 'Events' },
  { value: 'achievement', label: 'Achievements' },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.isRead;
    return n.type === filter;
  });

  // Group by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = format(date, 'MMMM d, yyyy');
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  };

  const markSelectedAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => (selectedIds.includes(n.id) ? { ...n, isRead: true } : n))
    );
    setSelectedIds([]);
  };

  const deleteSelected = () => {
    setNotifications((prev) => prev.filter((n) => !selectedIds.includes(n.id)));
    setSelectedIds([]);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Bell className="w-6 h-6 mr-2 text-primary-500" />
            Notifications
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notifications` : 'You\'re all caught up!'}
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

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          {/* Select All */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.length === filteredNotifications.length && filteredNotifications.length > 0}
              onChange={selectAll}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
            </span>
          </label>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={markSelectedAsRead}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition"
              >
                <Check className="w-4 h-4" />
                <span>Mark as read</span>
              </button>
              <button
                onClick={deleteSelected}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <Filter className="w-4 h-4" />
              <span>{filterOptions.find((f) => f.value === filter)?.label}</span>
            </button>

            {showFilters && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-10">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFilter(option.value);
                      setShowFilters(false);
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition',
                      filter === option.value
                        ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="card text-center py-16">
          <Bell className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No notifications
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'all'
              ? "You don't have any notifications yet"
              : `No ${filterOptions.find((f) => f.value === filter)?.label.toLowerCase()} to show`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([date, notifications]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                {date}
              </h3>
              <div className="space-y-2">
                {notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type] || AlertCircle;
                  const colorClass = notificationColors[notification.type] || notificationColors.system;

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'group relative bg-white dark:bg-gray-800 rounded-lg p-4 shadow hover:shadow-md transition',
                        !notification.isRead && 'ring-2 ring-primary-500/20'
                      )}
                    >
                      <div className="flex items-start space-x-4">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(notification.id)}
                          onChange={() => toggleSelect(notification.id)}
                          className="mt-1 rounded border-gray-300 dark:border-gray-600"
                        />

                        {/* Icon */}
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                            colorClass
                          )}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <Link
                          href={notification.link || '#'}
                          onClick={() => markAsRead(notification.id)}
                          className="flex-1 min-w-0"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {notification.title}
                                {!notification.isRead && (
                                  <span className="ml-2 inline-block w-2 h-2 bg-primary-500 rounded-full" />
                                )}
                              </p>
                              <p className="text-gray-600 dark:text-gray-300 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                                {formatDistanceToNow(new Date(notification.createdAt), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                          </div>
                        </Link>

                        {/* Actions */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-2 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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
