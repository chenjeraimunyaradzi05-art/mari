'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  Briefcase,
  Users,
  GraduationCap,
  MessageCircle,
  Sparkles,
  Settings,
  Heart,
  FileText,
  BookmarkIcon,
  Crown,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
  Lightbulb,
  Mic,
  Target,
  Radar,
  PenTool,
  X,
  Gift,
  Coins,
  Calculator,
  Receipt,
  Package,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, useAuthStore } from '@/lib/store';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  children?: NavItem[];
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/persona', label: 'Personas', icon: Target },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/dashboard/applications', label: 'My Applications', icon: FileText },
  { href: '/dashboard/saved-jobs', label: 'Saved Jobs', icon: BookmarkIcon },
];

const communityNavItems: NavItem[] = [
  { href: '/dashboard/community', label: 'Feed', icon: Users },
  { href: '/dashboard/groups', label: 'Groups', icon: Users },
  { href: '/dashboard/mentors', label: 'Find Mentors', icon: Heart },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageCircle, badge: 3 },
  { href: '/dashboard/events', label: 'Events', icon: Calendar },
  { href: '/dashboard/referrals', label: 'Invite Friends', icon: Gift },
];

const learningNavItems: NavItem[] = [
  { href: '/dashboard/learn', label: 'Courses', icon: GraduationCap },
  { href: '/dashboard/learn/my-courses', label: 'My Learning', icon: BookmarkIcon },
];

const aiToolsNavItems: NavItem[] = [
  { href: '/dashboard/ai', label: 'AI Hub', icon: Sparkles },
  { href: '/dashboard/ai/resume-optimizer', label: 'Resume Optimizer', icon: FileText },
  { href: '/dashboard/ai/interview-coach', label: 'Interview Coach', icon: Mic },
  { href: '/dashboard/ai/opportunity-radar', label: 'Opportunity Radar', icon: Radar },
  { href: '/dashboard/ai/career-path', label: 'Career Path', icon: TrendingUp },
  { href: '/dashboard/ai/content-generator', label: 'Content Generator', icon: PenTool },
  { href: '/dashboard/ai/idea-validator', label: 'Idea Validator', icon: Lightbulb },
];

const financeNavItems: NavItem[] = [
  { href: '/dashboard/finance', label: 'Finance Hub', icon: Calculator },
  { href: '/dashboard/finance/accounting', label: 'Accounting', icon: Calculator },
  { href: '/dashboard/finance/tax', label: 'Tax & Returns', icon: Receipt },
  { href: '/dashboard/finance/inventory', label: 'Inventory', icon: Package },
  { href: '/dashboard/finance/money', label: 'Money Ledger', icon: Banknote },
];

const settingsNavItems: NavItem[] = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/settings/help', label: 'Help & Support', icon: HelpCircle },
];

interface NavSectionProps {
  title: string;
  items: NavItem[];
  collapsed: boolean;
}

function NavSection({ title, items, collapsed }: NavSectionProps) {
  const pathname = usePathname();

  return (
    <div className="mb-6">
      {!collapsed && (
        <h3 className="px-4 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {title}
        </h3>
      )}
      <nav className="space-y-1 px-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition group',
                isActive
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 flex-shrink-0',
                  isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                )}
              />
              {!collapsed && (
                <>
                  <span className="ml-3 flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.badge && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-xs font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function DashboardSidebar() {
  const { user } = useAuthStore();
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, toggleSidebarCollapsed } = useUIStore();

  const isPro = user?.subscriptionTier !== 'FREE';

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Mobile Close Button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo (Mobile only) */}
        <div className="lg:hidden flex items-center space-x-2 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          {!sidebarCollapsed && (
            <span className="text-xl font-bold bg-gradient-to-r from-primary-500 to-purple-500 bg-clip-text text-transparent">
              ATHENA
            </span>
          )}
        </div>

        {/* Scrollable Nav Content */}
        <div className="flex-1 overflow-y-auto py-4">
          <NavSection title="Main" items={mainNavItems} collapsed={sidebarCollapsed} />
          <NavSection title="Community" items={communityNavItems} collapsed={sidebarCollapsed} />
          <NavSection title="Learning" items={learningNavItems} collapsed={sidebarCollapsed} />
          <NavSection title="AI Tools" items={aiToolsNavItems} collapsed={sidebarCollapsed} />
          <NavSection title="Finance" items={financeNavItems} collapsed={sidebarCollapsed} />
          <NavSection title="Settings" items={settingsNavItems} collapsed={sidebarCollapsed} />
        </div>

        {/* Credits Display */}
        {!sidebarCollapsed && user?.referralCredits !== undefined && user.referralCredits > 0 && (
          <Link
            href="/dashboard/referrals"
            className="mx-4 mb-2 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 hover:from-yellow-100 hover:to-amber-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {user.referralCredits} Credits
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  From referrals
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Pro Upgrade Card */}
        {!isPro && !sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <Crown className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Upgrade to Pro
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Unlock all AI tools
                  </p>
                </div>
              </div>
              <Link
                href="/pricing"
                className="mt-3 block w-full text-center bg-primary-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-primary-600 transition"
              >
                View Plans
              </Link>
            </div>
          </div>
        )}

        {/* Collapse Toggle (Desktop) */}
        <button
          onClick={toggleSidebarCollapsed}
          className="hidden lg:flex items-center justify-center p-3 border-t border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </aside>
    </>
  );
}
