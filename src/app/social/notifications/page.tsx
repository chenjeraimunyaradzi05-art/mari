'use client';

import React, { useEffect, useState } from 'react';
import { Heart, MessageCircle, UserPlus, Bell, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  actor?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (error) {
        console.error('Failed to fetch notifications', error);
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE': return <Heart className="w-5 h-5 text-white fill-white" />;
      case 'COMMENT': return <MessageCircle className="w-5 h-5 text-white fill-white" />;
      case 'FOLLOW': return <UserPlus className="w-5 h-5 text-white fill-white" />;
      default: return <Bell className="w-5 h-5 text-white" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'LIKE': return 'bg-rose-500';
      case 'COMMENT': return 'bg-blue-500';
      case 'FOLLOW': return 'bg-emerald-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white z-10 border-b border-slate-100">
        <div className="flex items-center p-4">
          <Link href="/social/feed" className="p-2 -ml-2 hover:bg-slate-50 rounded-full">
            <ArrowLeft className="w-6 h-6 text-slate-900" />
          </Link>
          <h1 className="font-bold text-lg ml-2">Notifications</h1>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-900">No notifications yet</h3>
            <p className="text-slate-500 text-sm mt-1">When people interact with you, they'll appear here.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div key={notification.id} className={`p-4 flex gap-4 ${!notification.isRead ? 'bg-rose-50/30' : ''}`}>
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden">
                  {notification.actor?.profileImage ? (
                    <img src={notification.actor.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">
                      {notification.actor?.firstName?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${getColor(notification.type)}`}>
                  {getIcon(notification.type)}
                </div>
              </div>
              <div className="flex-1 min-w-0 py-1">
                <p className="text-sm text-slate-900">
                  <span className="font-bold">{notification.actor?.firstName} {notification.actor?.lastName}</span>
                  {' '}{notification.message}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(notification.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
