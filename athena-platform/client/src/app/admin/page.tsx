'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Briefcase, 
  MessageSquare, 
  CreditCard,
  BarChart3,
  Shield,
  FileText,
  Settings,
  TrendingUp,
  Megaphone,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Car,
  Stethoscope,
  Store,
  Home,
  Landmark,
  Rocket,
  Wallet,
  HeartHandshake,
  Award,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { adminOpsApi, type RevenueSummary } from '@/lib/admin-ops-api';
import { useAuthStore } from '@/lib/hooks';

// The queues behind every directory partners join, so an admin has one door
// for all of them. The automotive queue lives under /dashboard/cars because
// the cars area guards its own admin page; the rest are under /admin.
const partnerLinks = [
  { href: '/dashboard/cars/admin', label: 'Automotive queues', icon: Car, description: 'Verify workshops and dealerships, held listings, disputes, finance' },
  { href: '/admin/practitioners', label: 'Health practitioners', icon: Stethoscope, description: 'Verify practitioners against the AHPRA register before they are listed' },
  { href: '/admin/vendors', label: 'Vendors', icon: Store, description: 'Verify the businesses members register for the supplier directory' },
  { href: '/admin/housing', label: 'Housing', icon: Home, description: 'Review DV-safe listings before they go live' },
  { href: '/admin/grants', label: 'Grants', icon: Landmark, description: 'Programmes and what the providers decided' },
  { href: '/admin/accelerator', label: 'Accelerator', icon: Rocket, description: 'Cohorts and applications' },
  { href: '/admin/investors', label: 'Investors', icon: Wallet, description: 'The investor directory' },
  { href: '/admin/impact', label: 'Impact', icon: HeartHandshake, description: 'Community programmes and impact reports' },
  { href: '/admin/credentials', label: 'Credentials', icon: Award, description: 'Certifications and the bodies that issue them' },
];

function formatMoney(amount: number, currency: string | null) {
  if (!currency || currency === 'UNKNOWN') return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

interface AdminStats {
  overview: {
    totalUsers: number;
    newUsersThisMonth: number;
    totalJobs: number;
    activeJobs: number;
    totalPosts: number;
    totalCourses: number;
    totalMentors: number;
  };
  subscriptions: {
    total: number;
    pro: number;
    business: number;
  };
  userBreakdown: {
    byPersona: Array<{ persona: string; _count: number }>;
    byRole: Array<{ role: string; _count: number }>;
  };
}

export default function AdminDashboardPage() {
  const { user } = useAuthStore();
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/stats');
      return response.data;
    },
  });
  // Recurring revenue is summed on the server from the amounts Stripe
  // recorded, never from a price table: this card used to multiply tier
  // counts by 29 and 99, prices no tier in the enum has.
  const revenue = useQuery({
    queryKey: ['admin-ops-revenue'],
    queryFn: () => adminOpsApi.revenue(),
    select: (r) => r.data as RevenueSummary,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error && user?.role === 'MODERATOR') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center">
        <Shield className="h-16 w-16 text-indigo-500" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Moderation</h1>
        <p className="max-w-md text-slate-600 dark:text-slate-400">You work the report queue and appeals. The rest of admin belongs to the platform admins.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/admin/moderation">Report queue</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/appeals">Appeals</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Access Denied</h1>
        <p className="text-slate-600 dark:text-slate-400">You don't have permission to access the admin dashboard.</p>
        <Button asChild>
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.overview.totalUsers || 0, icon: Users, color: 'bg-blue-500' },
    { label: 'New This Month', value: stats?.overview.newUsersThisMonth || 0, icon: TrendingUp, color: 'bg-green-500' },
    { label: 'Active Jobs', value: stats?.overview.activeJobs || 0, icon: Briefcase, color: 'bg-purple-500' },
    { label: 'Total Posts', value: stats?.overview.totalPosts || 0, icon: MessageSquare, color: 'bg-orange-500' },
    { label: 'Pro Subscriptions', value: stats?.subscriptions.pro || 0, icon: CreditCard, color: 'bg-pink-500' },
    { label: 'Active Mentors', value: stats?.overview.totalMentors || 0, icon: Users, color: 'bg-teal-500' },
  ];

  const adminLinks = [
    { href: '/admin/users', label: 'User Management', icon: Users, description: 'Manage users, roles, and suspensions' },
    { href: '/admin/women-gate', label: 'Women-only Gate', icon: Shield, description: 'Invite codes and verification approvals' },
    { href: '/admin/moderation', label: 'Report Queue', icon: AlertTriangle, description: 'Work user reports: claim, decide, enforce' },
    { href: '/admin/appeals', label: 'Appeals', icon: Shield, description: 'Review appeals against moderation decisions' },
    { href: '/admin/content', label: 'Content Moderation', icon: Shield, description: 'Review reported posts and comments' },
    { href: '/admin/groups', label: 'Group Moderation', icon: Users, description: 'Feature, pin, or hide groups' },
    { href: '/admin/events', label: 'Event Moderation', icon: Calendar, description: 'Feature, pin, or hide events' },
    { href: '/admin/compliance', label: 'GDPR & UK Compliance', icon: Shield, description: 'Consent ledger, DSARs, and UK/EU readiness' },
    { href: '/admin/breaches', label: 'Data Breach Register', icon: AlertTriangle, description: 'Record incidents, run the notification clocks, notify the regulator' },
    { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileText, description: 'Review compliance exports and deletions' },
    { href: '/admin/jobs', label: 'Job Management', icon: Briefcase, description: 'Approve, feature, or remove job listings' },
    { href: '/admin/grants', label: 'Grant Applications', icon: FileText, description: 'Record what the grant providers decided' },
    { href: '/admin/insurance', label: 'Insurance Applications', icon: FileText, description: 'Record quotes, approvals and policies' },
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard, description: 'Manage user subscriptions' },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, description: 'Platform metrics and insights' },
    { href: '/admin/gtm', label: 'Go-to-Market', icon: Target, description: 'Launch plans, channels, and initiatives' },
    { href: '/admin/marketing', label: 'Marketing Hub', icon: Megaphone, description: 'Campaigns, leads, and growth ops' },
    { href: '/admin/blog', label: 'Blog', icon: FileText, description: 'Write, publish and archive the articles on /blog' },
    { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare, description: 'What people send from the help centre, worked through' },
    { href: '/admin/verification', label: 'Verification Requests', icon: Shield, description: 'Approve employer, educator, mentor and creator badges' },
    { href: '/admin/feature-flags', label: 'Feature Flags', icon: Settings, description: 'Flags, rollouts and maintenance mode' },
    { href: '/admin/settings', label: 'Settings', icon: Settings, description: 'What is running and how it is configured, as the API reports it' },
  ];

  const r = revenue.data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-slate-600 dark:text-slate-400">ATHENA Platform Management</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to App</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recurring revenue, from recorded subscription amounts only */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow p-6 mb-8 text-white">
          {revenue.isLoading ? (
            <p className="text-purple-100">Reading recorded subscription amounts…</p>
          ) : !r ? (
            <p className="text-purple-100">Recurring revenue could not be read.</p>
          ) : r.mrr === null ? (
            <div>
              <p className="text-purple-100">Monthly recurring revenue</p>
              <p className="text-2xl font-semibold">
                {r.mixedCurrencies ? 'More than one currency, so no single figure' : 'Not enough recorded amounts yet'}
              </p>
              <p className="mt-1 text-sm text-purple-100">
                {r.subscriptions.paying === 0
                  ? 'No paying subscriptions yet.'
                  : `${r.subscriptions.paying} paying ${r.subscriptions.paying === 1 ? 'subscription' : 'subscriptions'}, ${r.subscriptions.recorded} with an amount recorded by Stripe.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-purple-100">Monthly recurring revenue</p>
                <p className="text-4xl font-bold">{formatMoney(r.mrr, r.currency)}</p>
                <p className="mt-1 text-sm text-purple-100">
                  From {r.subscriptions.recorded} recorded {r.subscriptions.recorded === 1 ? 'subscription' : 'subscriptions'}
                  {r.subscriptions.notRecorded > 0 && `; ${r.subscriptions.notRecorded} more paying with no amount recorded`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-purple-100">Annualised</p>
                <p className="text-2xl font-semibold">{r.arr === null ? '—' : formatMoney(r.arr, r.currency)}</p>
              </div>
            </div>
          )}
        </div>

        {/* User Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Users by Persona</h3>
            <div className="space-y-3">
              {stats?.userBreakdown.byPersona.map((item) => (
                <div key={item.persona} className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 capitalize">
                    {item.persona.toLowerCase().replace('_', ' ')}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">{item._count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Users by Role</h3>
            <div className="space-y-3">
              {stats?.userBreakdown.byRole.map((item) => (
                <div key={item.role} className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 capitalize">
                    {item.role.toLowerCase()}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">{item._count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg">
                  <link.icon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{link.label}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{link.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Partner listings: one door for every directory queue */}
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-10 mb-1">Partner listings</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">The queues behind every directory partners join: verify, approve or hide.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partnerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg">
                  <link.icon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{link.label}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{link.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
