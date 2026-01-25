'use client';

/**
 * Super App Navigation
 * Multi-mode navigation for Social, Professional, Learning, and Business modes
 * Phase 3: Web Client - Super App Core
 */

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore, type AppMode } from '@/lib/stores/ui.store';
import { useChatStore } from '@/lib/stores/chat.store';
import { useNotificationStore } from '@/lib/stores/notification.store';
import {
  Home,
  Play,
  MessageCircle,
  Bell,
  Search,
  Briefcase,
  GraduationCap,
  Building2,
  Users,
  User,
  Settings,
  Menu,
  X,
  Compass,
  Sparkles,
  Heart,
  Bookmark,
  PlusCircle,
  Video,
  Calendar,
  TrendingUp,
  Shield,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

// Mode configurations
const MODE_CONFIG: Record<AppMode, { label: string; icon: React.ElementType; color: string }> = {
  social: { label: 'Social', icon: Heart, color: 'text-pink-500' },
  professional: { label: 'Career', icon: Briefcase, color: 'text-blue-500' },
  learning: { label: 'Learn', icon: GraduationCap, color: 'text-green-500' },
  business: { label: 'Business', icon: Building2, color: 'text-purple-500' },
};

// Navigation items per mode
const NAV_ITEMS: Record<AppMode, { label: string; icon: React.ElementType; href: string }[]> = {
  social: [
    { label: 'Feed', icon: Home, href: '/feed' },
    { label: 'Discover', icon: Compass, href: '/discover' },
    { label: 'Videos', icon: Play, href: '/videos' },
    { label: 'Communities', icon: Users, href: '/communities' },
    { label: 'Events', icon: Calendar, href: '/events' },
  ],
  professional: [
    { label: 'Dashboard', icon: Home, href: '/dashboard' },
    { label: 'Jobs', icon: Briefcase, href: '/jobs' },
    { label: 'Mentors', icon: Users, href: '/mentors' },
    { label: 'Network', icon: Sparkles, href: '/network' },
    { label: 'Salary', icon: TrendingUp, href: '/salary-insights' },
  ],
  learning: [
    { label: 'My Learning', icon: Home, href: '/learning' },
    { label: 'Courses', icon: GraduationCap, href: '/courses' },
    { label: 'Skills', icon: Sparkles, href: '/skills' },
    { label: 'Certifications', icon: Shield, href: '/certifications' },
    { label: 'Mentorship', icon: Users, href: '/mentorship' },
  ],
  business: [
    { label: 'Dashboard', icon: Home, href: '/business' },
    { label: 'Formation', icon: Building2, href: '/formation' },
    { label: 'Finances', icon: Wallet, href: '/finances' },
    { label: 'Team', icon: Users, href: '/team' },
    { label: 'Growth', icon: TrendingUp, href: '/growth' },
  ],
};

interface SuperAppNavProps {
  className?: string;
}

export function SuperAppNav({ className }: SuperAppNavProps) {
  const pathname = usePathname();
  const {
    currentMode,
    setMode,
    sidebarState,
    toggleSidebar,
    toggleSearch,
    setNotificationPanelOpen,
    setChatPanelOpen,
  } = useUIStore();
  const { totalUnread: chatUnread } = useChatStore();
  const { unreadCount: notifUnread } = useNotificationStore();

  const isCollapsed = sidebarState === 'collapsed';
  const navItems = NAV_ITEMS[currentMode];
  const modeConfig = MODE_CONFIG[currentMode];

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-screen bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300',
          isCollapsed ? 'w-[72px]' : 'w-[240px]',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/" className={cn('flex items-center gap-2', isCollapsed && 'mr-auto')}
          >
            <Image
              src="/logo.svg"
              alt="ATHENA"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg"
            />
            {!isCollapsed && <span className="font-semibold text-lg">Athena</span>}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="shrink-0"
          >
            {isCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mode Switcher */}
        <div className={cn('p-2 border-b border-zinc-200 dark:border-zinc-800', isCollapsed && 'px-1')}>
          <div className={cn('flex gap-1', isCollapsed ? 'flex-col' : 'flex-row')}>
            {(Object.keys(MODE_CONFIG) as AppMode[]).map((mode) => {
              const config = MODE_CONFIG[mode];
              const Icon = config.icon;
              const isActive = currentMode === mode;

              return (
                <Tooltip key={mode}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      size={isCollapsed ? 'icon' : 'sm'}
                      onClick={() => setMode(mode)}
                      className={cn(
                        'flex-1',
                        isActive && config.color,
                        isCollapsed && 'w-full'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
                      {!isCollapsed && <span className="text-xs">{config.label}</span>}
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">{config.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900',
                      isCollapsed && 'justify-center px-2'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        {/* Quick Actions */}
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
          {/* Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={toggleSearch}
                className={cn(
                  'w-full justify-start gap-3',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <Search className="h-5 w-5" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">Search</span>
                    <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-zinc-100 dark:bg-zinc-800 px-1.5 font-mono text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                      ⌘K
                    </kbd>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Search (⌘K)</TooltipContent>}
          </Tooltip>

          {/* Messages */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => setChatPanelOpen(true)}
                className={cn(
                  'w-full justify-start gap-3 relative',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <MessageCircle className="h-5 w-5" />
                {!isCollapsed && <span>Messages</span>}
                {chatUnread > 0 && (
                  <Badge
                    variant="destructive"
                    className={cn(
                      'absolute px-1.5 min-w-[20px] h-5',
                      isCollapsed ? 'top-0 right-0' : 'right-2'
                    )}
                  >
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Messages</TooltipContent>}
          </Tooltip>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => setNotificationPanelOpen(true)}
                className={cn(
                  'w-full justify-start gap-3 relative',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <Bell className="h-5 w-5" />
                {!isCollapsed && <span>Notifications</span>}
                {notifUnread > 0 && (
                  <Badge
                    variant="destructive"
                    className={cn(
                      'absolute px-1.5 min-w-[20px] h-5',
                      isCollapsed ? 'top-0 right-0' : 'right-2'
                    )}
                  >
                    {notifUnread > 99 ? '99+' : notifUnread}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Notifications</TooltipContent>}
          </Tooltip>

          {/* Create */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                className={cn(
                  'w-full justify-start gap-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <PlusCircle className="h-5 w-5" />
                {!isCollapsed && <span>Create</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Create</TooltipContent>}
          </Tooltip>
        </div>

        {/* User Section */}
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/profile"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">My Profile</p>
                    <p className="text-xs text-zinc-500 truncate">View & Edit</p>
                  </div>
                )}
              </Link>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">My Profile</TooltipContent>}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-600 dark:text-zinc-400',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <Settings className="h-5 w-5" />
                {!isCollapsed && <span className="text-sm">Settings</span>}
              </Link>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Settings</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export default SuperAppNav;
