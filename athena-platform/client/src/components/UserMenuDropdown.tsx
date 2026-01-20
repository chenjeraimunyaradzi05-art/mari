'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Settings,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronDown,
  Moon,
  Sun,
  Crown,
  Briefcase,
  BookOpen,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, useUIStore } from '@/lib/store';
import { useLogout } from '@/lib/hooks';
import { Avatar } from '@/components/ui';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  divider?: boolean;
}

export default function UserMenuDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout: storeLogout } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const logoutMutation = useLogout();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Still logout locally even if API fails
    }
    storeLogout();
    router.push('/login');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const menuItems: MenuItem[] = [
    {
      icon: User,
      label: 'My Profile',
      href: `/dashboard/profile/${user?.id}`,
    },
    {
      icon: Briefcase,
      label: 'My Applications',
      href: '/dashboard/applications',
    },
    {
      icon: BookOpen,
      label: 'My Courses',
      href: '/dashboard/learn/my-courses',
    },
    {
      icon: MessageCircle,
      label: 'Messages',
      href: '/dashboard/messages',
      badge: '3',
    },
    {
      icon: Crown,
      label: 'Upgrade to Pro',
      href: '/pricing',
      divider: true,
    },
    {
      icon: Settings,
      label: 'Settings',
      href: '/dashboard/settings',
    },
    {
      icon: CreditCard,
      label: 'Billing',
      href: '/dashboard/settings/billing',
    },
    {
      icon: theme === 'dark' ? Sun : Moon,
      label: theme === 'dark' ? 'Light Mode' : 'Dark Mode',
      onClick: toggleTheme,
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      href: '/dashboard/settings/help',
      divider: true,
    },
    {
      icon: LogOut,
      label: 'Sign Out',
      onClick: handleLogout,
    },
  ];

  const isPro = user?.subscriptionTier !== 'FREE';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
      >
        <Avatar
          src={user?.avatar}
          alt={user?.firstName || 'User'}
          size="sm"
          className="w-8 h-8"
        />
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
            {user?.firstName} {user?.lastName}
          </p>
          <div className="flex items-center">
            {isPro && (
              <span className="inline-flex items-center text-xs text-primary-500 mr-1">
                <Crown className="w-3 h-3 mr-0.5" />
                Pro
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
              {user?.email}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 hidden md:block transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* User Info Header (Mobile) */}
          <div className="md:hidden p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <Avatar
                src={user?.avatar}
                alt={user?.firstName || 'User'}
                size="md"
                className="w-10 h-10"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            {isPro && (
              <div className="mt-2">
                <span className="inline-flex items-center px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs rounded-full">
                  <Crown className="w-3 h-3 mr-1" />
                  Pro Member
                </span>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item, index) => (
              <div key={item.label}>
                {item.divider && index > 0 && (
                  <div className="my-2 border-t border-gray-100 dark:border-gray-700" />
                )}
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4 text-gray-400" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      item.onClick?.();
                      if (item.label === 'Sign Out') {
                        setIsOpen(false);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4 text-gray-400" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Pro Upgrade CTA (for non-pro users) */}
          {!isPro && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <Crown className="w-5 h-5 text-primary-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Upgrade to Pro
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Unlock all AI tools & features
                  </p>
                </div>
              </div>
              <Link
                href="/pricing"
                onClick={() => setIsOpen(false)}
                className="mt-3 block w-full text-center bg-primary-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-primary-600 transition"
              >
                View Plans
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
