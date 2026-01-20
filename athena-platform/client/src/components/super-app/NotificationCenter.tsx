'use client';

/**
 * Notification Center - Aggregated notifications with Mark as Read
 * Phase 3: Web Client - Super App Core
 */

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useNotificationStore, type Notification } from '@/lib/stores/notification.store';
import { useUIStore } from '@/lib/stores/ui.store';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  UserPlus,
  Briefcase,
  GraduationCap,
  Calendar,
  Star,
  Award,
  AlertCircle,
  Settings,
  Trash2,
  Archive,
  Filter,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

type NotificationFilter = 'all' | 'unread' | 'mentions' | 'jobs' | 'social';

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  job_match: Briefcase,
  job_application: Briefcase,
  course_complete: GraduationCap,
  course_reminder: GraduationCap,
  event: Calendar,
  mention: Star,
  achievement: Award,
  system: AlertCircle,
  default: Bell,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  like: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  comment: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  follow: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  job_match: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  job_application: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  course_complete: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  course_reminder: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  event: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  mention: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  achievement: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  system: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  default: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export function NotificationCenter() {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotificationStore();
  
  const { isNotificationPanelOpen, setNotificationPanelOpen } = useUIStore();

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      switch (filter) {
        case 'unread':
          return !notification.isRead;
        case 'mentions':
          return notification.type === 'MENTION';
        case 'jobs':
          return notification.type.startsWith('JOB');
        case 'social':
          return ['MENTION', 'MESSAGE'].includes(notification.type);
        default:
          return true;
      }
    });
  }, [notifications, filter]);

  const groupedNotifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups: { label: string; items: Notification[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'This Week', items: [] },
      { label: 'Earlier', items: [] },
    ];

    filteredNotifications.forEach((notification) => {
      const date = new Date(notification.createdAt);
      date.setHours(0, 0, 0, 0);

      if (date.getTime() === today.getTime()) {
        groups[0].items.push(notification);
      } else if (date.getTime() === yesterday.getTime()) {
        groups[1].items.push(notification);
      } else if (date > thisWeek) {
        groups[2].items.push(notification);
      } else {
        groups[3].items.push(notification);
      }
    });

    return groups.filter((group) => group.items.length > 0);
  }, [filteredNotifications]);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) {
        markAsRead(notification.id);
      }
      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }
    },
    [markAsRead]
  );

  return (
    <Sheet open={isNotificationPanelOpen} onOpenChange={setNotificationPanelOpen}>
      <SheetContent className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Mark all read
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <BellOff className="h-4 w-4 mr-2" />
                    Notification Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-500"
                    onClick={clearAll}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </SheetHeader>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as NotificationFilter)}>
          <TabsList className="w-full justify-start px-4 py-2 h-auto bg-transparent border-b border-zinc-200 dark:border-zinc-800 rounded-none">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="mentions" className="text-xs">Mentions</TabsTrigger>
            <TabsTrigger value="jobs" className="text-xs">Jobs</TabsTrigger>
            <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-140px)]">
            <TabsContent value={filter} className="m-0">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                  <Bell className="h-12 w-12 mb-4 opacity-30" />
                  <p className="font-medium">No notifications</p>
                  <p className="text-sm mt-1">
                    {filter === 'all'
                      ? "You're all caught up!"
                      : `No ${filter} notifications`}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {groupedNotifications.map((group) => (
                    <div key={group.label}>
                      <div className="px-4 py-2 text-xs font-medium text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
                        {group.label}
                      </div>
                      {group.items.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onClick={() => handleNotificationClick(notification)}
                          onDelete={() => deleteNotification(notification.id)}
                          onMarkRead={() => markAsRead(notification.id)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDelete: () => void;
  onMarkRead: () => void;
}

function NotificationItem({
  notification,
  onClick,
  onDelete,
  onMarkRead,
}: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.default;
  const colorClass = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.default;

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors',
        !notification.isRead && 'bg-blue-50/50 dark:bg-blue-900/10'
      )}
      onClick={onClick}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
      )}

      {/* Icon or Avatar */}
      {notification.actorAvatar ? (
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={notification.actorAvatar} />
            <AvatarFallback>{notification.actorName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              'absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center',
              colorClass
            )}
          >
            <Icon className="h-3 w-3" />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            colorClass
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          {notification.actorName && (
            <span className="font-semibold">{notification.actorName} </span>
          )}
          <span className={cn(!notification.isRead && 'font-medium')}>
            {notification.message}
          </span>
        </p>
        {notification.preview && (
          <p className="text-sm text-zinc-500 truncate mt-0.5">
            {notification.preview}
          </p>
        )}
        <p className="text-xs text-zinc-400 mt-1">
          {formatNotificationTime(notification.createdAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-400 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function formatNotificationTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Bell button component for triggering the notification center
export function NotificationBell() {
  const { unreadCount } = useNotificationStore();
  const { setNotificationPanelOpen } = useUIStore();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={() => setNotificationPanelOpen(true)}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );
}

export default NotificationCenter;
