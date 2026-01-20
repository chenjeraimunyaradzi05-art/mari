'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Search,
  X,
  Home,
  Briefcase,
  Users,
  GraduationCap,
  MessageCircle,
  Sparkles,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationDropdown from './NotificationDropdown';
import UserMenuDropdown from './UserMenuDropdown';
import { useUIStore } from '@/lib/store';
import GlobalSearchCommand from '@/components/search/GlobalSearchCommand';

const mainNavItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/dashboard/community', label: 'Community', icon: Users },
  { href: '/dashboard/mentors', label: 'Mentors', icon: Users },
  { href: '/dashboard/learn', label: 'Learn', icon: GraduationCap },
  { href: '/dashboard/ai', label: 'AI Tools', icon: Sparkles },
];

export default function DashboardHeader() {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Toggle */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="hidden md:block text-xl font-bold bg-gradient-to-r from-primary-500 to-purple-500 bg-clip-text text-transparent">
              ATHENA
            </span>
          </Link>

          {/* Main Nav (Desktop) */}
          <nav className="hidden lg:flex items-center space-x-1 ml-8">
            {mainNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition',
                    isActive
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2">
          {/* Search (Desktop) */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-3 px-3 py-2 w-64 lg:w-80 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 transition"
            aria-label="Open search"
          >
            <Search className="w-4 h-4 text-gray-400" />
            <span className="flex-1 text-left">Search people, jobs, courses...</span>
            <span className="text-xs text-gray-400 border border-gray-200 dark:border-gray-700 rounded px-2 py-0.5">⌘K</span>
          </button>

          {/* Search Toggle (Mobile) */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="md:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            aria-label="Search"
          >
            {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>

          {/* Quick Create */}
          <Link
            href="/dashboard/creator-studio"
            className="hidden sm:flex items-center space-x-1 px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden lg:inline">Create</span>
          </Link>

          {/* Messages */}
          <Link
            href="/dashboard/messages"
            className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            aria-label="Messages"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              3
            </span>
          </Link>

          {/* Notifications */}
          <NotificationDropdown />

          {/* User Menu */}
          <UserMenuDropdown />
        </div>
      </div>

      {/* Mobile Search Bar */}
      {showSearch && (
        <div className="md:hidden p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              setIsSearchOpen(true);
              setShowSearch(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-300"
          >
            <Search className="w-4 h-4 text-gray-400" />
            <span className="flex-1 text-left">Search across Athena...</span>
          </button>
        </div>
      )}

      <GlobalSearchCommand open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </header>
  );
}
