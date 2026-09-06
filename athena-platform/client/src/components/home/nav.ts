/**
 * The primary navigation, in one place: the header reads it, and so does the
 * phone's bottom bar (which takes the first five, so the order matters).
 */

import { Briefcase, Calendar, Compass, GraduationCap, Home, Search, Sparkles, TrendingUp, Users, type LucideIcon } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const HOME_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Reels', icon: Compass },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/mentors', label: 'Mentors', icon: Users },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/learning', label: 'Learning', icon: GraduationCap },
  { href: '/communities', label: 'Communities', icon: Sparkles },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/salary-insights', label: 'Salary', icon: TrendingUp },
];
