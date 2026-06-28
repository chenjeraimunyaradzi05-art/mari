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
  Command,
  DollarSign,
  FileText,
  ShieldCheck,
  Target,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth, useNotifications, useUnreadMessageCount } from '@/lib/hooks';
import { useUIStore } from '@/lib/store';
import { cn, getFullName, getInitials } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import GlobalSearchCommand from '@/components/search/GlobalSearchCommand';

type AppMode = 'social' | 'professional' | 'learning' | 'business';
type NavigationItem = { name: string; href: string; icon: LucideIcon };

const appModes = ['social', 'professional', 'learning', 'business'] satisfies AppMode[];

const isAppMode = (value: string | null): value is AppMode =>
  Boolean(value && appModes.includes(value as AppMode));

const modeMeta: Record<AppMode, { label: string; shortLabel: string; description: string; icon: LucideIcon }> = {
  social: {
    label: 'Social',
    shortLabel: 'So',
    description: 'Community, messages, creators',
    icon: Users,
  },
  professional: {
    label: 'Career',
    shortLabel: 'Ca',
    description: 'Jobs, mentors, companies',
    icon: Briefcase,
  },
  learning: {
    label: 'Learn',
    shortLabel: 'Le',
    description: 'Courses and cohorts',
    icon: GraduationCap,
  },
  business: {
    label: 'Business',
    shortLabel: 'Bu',
    description: 'Finance, grants, impact',
    icon: Building2,
  },
};

const modeNavigation: Record<AppMode, NavigationItem[]> = {
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
  business: [
    { name: 'Business OS', href: '/dashboard/finance', icon: DollarSign },
    { name: 'Formation', href: '/dashboard/formation', icon: Building2 },
    { name: 'Grants', href: '/dashboard/grants', icon: Target },
    { name: 'Impact', href: '/dashboard/impact', icon: ShieldCheck },
    { name: 'RFPs', href: '/dashboard/rfps', icon: FileText },
    { name: 'AI Tools', href: '/dashboard/ai', icon: Sparkles },
  ],
};

const secondaryNav = [
  { name: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
] satisfies NavigationItem[];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isSidebarOpen, toggleSidebar, theme, setTheme } = useUIStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mode, setMode] = useState<AppMode>('social');

  useEffect(() => {
    const savedMode = window.localStorage.getItem('athena-mode');
    if (isAppMode(savedMode)) {
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
  const unreadMessageCount = unreadMessages ?? 0;
  const ActiveModeIcon = modeMeta[mode].icon;

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
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white dark:focus:bg-white dark:focus:text-slate-950"
      >
        Skip to dashboard content
      </a>
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-xl shadow-slate-950/5 transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0 lg:shadow-none',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          !isSidebarOpen && 'lg:w-20'
        )}
      >
        {/* Logo */}
        <div className="flex h-18 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Image src="/logo.svg" alt="ATHENA" width={32} height={32} className="rounded-lg flex-shrink-0" />
            {isSidebarOpen && (
              <span className="text-xl font-bold gradient-text">ATHENA</span>
            )}
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          <ul className="space-y-1">
            {modeNavigation[mode].map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      isActive
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
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
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Mode
                </div>
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-300">
                  <ActiveModeIcon className="h-3 w-3" />
                  {modeMeta[mode].label}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
              {appModes.map((key) => {
                const item = modeMeta[key];
                const ModeIcon = item.icon;
                return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  title={item.description}
                  className={cn(
                    'flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition',
                    mode === key
                      ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  <ModeIcon className="h-3.5 w-3.5" />
                  {isSidebarOpen ? item.label : <span className="sr-only">{item.label}</span>}
                </button>
              );
              })}
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
                  (item.name === 'Messages' && unreadMessageCount > 0);

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
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
          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="rounded-lg bg-slate-950 p-4 text-white dark:bg-white dark:text-slate-950">
              <div className="flex items-center space-x-2 mb-2">
                <Crown className="w-5 h-5" />
                <span className="font-semibold">Upgrade to Pro</span>
              </div>
              <p className="text-sm text-white/90 mb-3">
                Unlock AI tools, unlimited applications & more.
              </p>
              <Link
                href="/dashboard/settings/billing"
                className="block w-full rounded-lg bg-white py-2 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-100 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
              >
                Upgrade Now
              </Link>
            </div>
          </div>
        )}

        {/* User profile */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-expanded={isProfileOpen}
              aria-label="Open account menu"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-200">
                {user ? getInitials(user.firstName, user.lastName) : '?'}
              </div>
              {isSidebarOpen && (
                <>
                  <div className="flex-1 text-left">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user ? getFullName(user.firstName, user.lastName) : 'Guest'}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user?.email}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </>
              )}
            </button>

            {/* Profile dropdown */}
            {isProfileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-slate-200 bg-white py-1 shadow-xl shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900">
                <Link
                  href={`/dashboard/profile/${user?.id}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <User className="w-4 h-4" />
                  <span>View Profile</span>
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
                <hr className="my-1 border-slate-200 dark:border-slate-700" />
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
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
      <div className={cn('transition-all lg:pl-72', !isSidebarOpen && 'lg:pl-20')}>
        {/* Top navbar */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <div className="flex h-full items-center justify-between px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={toggleSidebar}
                className="hidden rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:block dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Collapse sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="relative hidden w-[min(30rem,46vw)] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-left text-sm text-slate-500 outline-none transition hover:border-primary-200 hover:bg-white hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-primary-400/40 dark:hover:bg-slate-900/80 dark:hover:text-slate-200 sm:flex"
                aria-label="Open global search"
              >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <span className="min-w-0 flex-1 truncate">Search jobs, people, grants, learning...</span>
                <span className="hidden items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-950 md:inline-flex">
                  <Command className="h-3 w-3" /> K
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Create post button */}
              <Link
                href="/dashboard/create-post"
                className="hidden items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 sm:flex dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <PenSquare className="w-4 h-4" />
                <span className="text-sm font-medium">Post</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Open search"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
                className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Notifications"
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
                className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Messages"
              >
                <MessageSquare className="w-5 h-5" />
                {unreadMessageCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
      <GlobalSearchCommand open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </div>
  );
}
