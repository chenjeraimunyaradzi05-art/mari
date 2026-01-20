'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Briefcase,
  Users,
  BookOpen,
  MessageSquare,
  Bell,
  Settings,
  Menu,
  X,
  Search,
  Sparkles,
  Building2,
  GraduationCap,
  PenSquare,
  User,
  ChevronDown,
  LogOut,
  Crown,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAuth, useNotifications, useUnreadMessageCount } from '@/lib/hooks';
import { useUIStore } from '@/lib/store';
import { cn, getFullName, getInitials } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

type AppMode = 'social' | 'professional' | 'learning';

const modeNavigation: Record<AppMode, { name: string; href: string; icon: any }[]> = {
  social: [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Community', href: '/dashboard/community', icon: Users },
    { name: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
    { name: 'Creator Studio', href: '/dashboard/creator-studio', icon: PenSquare },
    { name: 'AI Tools', href: '/dashboard/ai', icon: Sparkles },
  ],
  professional: [
    { name: 'Jobs', href: '/dashboard/jobs', icon: Briefcase },
    { name: 'Mentors', href: '/dashboard/mentors', icon: GraduationCap },
    { name: 'Companies', href: '/dashboard/companies', icon: Building2 },
    { name: 'AI Tools', href: '/dashboard/ai', icon: Sparkles },
  ],
  learning: [
    { name: 'Learn', href: '/dashboard/learn', icon: BookOpen },
    { name: 'Courses', href: '/dashboard/learn', icon: BookOpen },
    { name: 'Community', href: '/dashboard/community', icon: Users },
  ],
};

const secondaryNav = [
  { name: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const { isSidebarOpen, toggleSidebar, theme, setTheme } = useUIStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mode, setMode] = useState<AppMode>('social');

  useEffect(() => {
    const savedMode = window.localStorage.getItem('athena-mode') as AppMode | null;
    if (savedMode) {
      setMode(savedMode);
    }
  }, []);

  useEffect(() => {
    trackEvent({ name: 'dashboard_view', properties: { mode } });
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem('athena-mode', mode);
  }, [mode]);

  const { data: notificationsData } = useNotifications({ limit: 5 });
  const { data: unreadMessages } = useUnreadMessageCount();

  const unreadCount = notificationsData?.unreadCount || 0;

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
      return;
    }

    if (theme === 'light') {
      setTheme('dark');
      return;
    }

    // If currently following system, toggle away from the current system preference.
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-300 lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          !isSidebarOpen && 'lg:w-20'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-athena-gradient rounded-lg flex-shrink-0" />
            {isSidebarOpen && (
              <span className="text-xl font-bold gradient-text">ATHENA</span>
            )}
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {modeNavigation[mode].map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors',
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 px-3">
            {isSidebarOpen && (
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Mode
              </div>
            )}
            <div className="flex items-center gap-2">
              {([
                { key: 'social', label: 'Social' },
                { key: 'professional', label: 'Career' },
                { key: 'learning', label: 'Learn' },
              ] as { key: AppMode; label: string }[]).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setMode(item.key)}
                  className={cn(
                    'flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition border',
                    mode === item.key
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                  )}
                >
                  {isSidebarOpen ? item.label : item.label.charAt(0)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            {isSidebarOpen && (
              <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Account
              </div>
            )}
            <ul className="space-y-1">
              {secondaryNav.map((item) => {
                const isActive = pathname === item.href;
                const hasNotification =
                  (item.name === 'Notifications' && unreadCount > 0) ||
                  (item.name === 'Messages' && unreadMessages > 0);

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors relative',
                        isActive
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      <div className="relative">
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {hasNotification && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                      {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Upgrade CTA */}
        {isSidebarOpen && user?.subscriptionTier === 'FREE' && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg p-4 text-white">
              <div className="flex items-center space-x-2 mb-2">
                <Crown className="w-5 h-5" />
                <span className="font-semibold">Upgrade to Pro</span>
              </div>
              <p className="text-sm text-white/90 mb-3">
                Unlock AI tools, unlimited applications & more.
              </p>
              <Link
                href="/dashboard/settings/billing"
                className="block w-full bg-white text-primary-600 text-center py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
              >
                Upgrade Now
              </Link>
            </div>
          </div>
        )}

        {/* User profile */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold">
                {user ? getInitials(user.firstName, user.lastName) : '?'}
              </div>
              {isSidebarOpen && (
                <>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {user ? getFullName(user.firstName, user.lastName) : 'Guest'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.email}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </>
              )}
            </button>

            {/* Profile dropdown */}
            {isProfileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                <Link
                  href={`/dashboard/profile/${user?.id}`}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <User className="w-4 h-4" />
                  <span>View Profile</span>
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 w-full"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('lg:pl-64 transition-all', !isSidebarOpen && 'lg:pl-20')}>
        {/* Top navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={toggleSidebar}
                className="hidden lg:block p-2 text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Search */}
              <div className="hidden sm:block relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs, people, companies..."
                  className="w-80 pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Create post button */}
              <Link
                href="/dashboard/create-post"
                className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition"
              >
                <PenSquare className="w-4 h-4" />
                <span className="text-sm font-medium">Post</span>
              </Link>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : theme === 'light' ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Monitor className="w-5 h-5" />
                )}
              </button>

              {/* Notifications */}
              <Link
                href="/dashboard/notifications"
                className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Messages */}
              <Link
                href="/dashboard/messages"
                className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <MessageSquare className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  );
}
