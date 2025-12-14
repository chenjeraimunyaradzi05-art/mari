"use client";

import React, { useState } from 'react';
import useSWR from 'swr';

type Notification = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actorId?: string;
  relatedId?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NotificationBell() {
  const { data, mutate } = useSWR('/api/notifications', fetcher, {
    refreshInterval: 15000, // Poll every 15s
  });

  const [isOpen, setIsOpen] = useState(false);

  const notifications: Notification[] = data?.data || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
      mutate(); // Refresh data
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const handleToggle = () => setIsOpen(!isOpen);

  return (
    <div className="relative inline-block">
      <button
        onClick={handleToggle}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        aria-label="Notifications"
      >
        <i className="fas fa-bell text-xl" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 w-80 mt-2 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
            <div className="px-4 py-2 text-sm font-semibold text-gray-700 border-b border-gray-100">
              Notifications
            </div>
            
            {notifications.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">No notifications</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 text-sm border-b border-gray-100 hover:bg-gray-50 ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-gray-800">{notification.message}</p>
                      {!notification.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                          title="Mark as read"
                        >
                          <i className="fas fa-check" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
