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
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Megaphone,
  Target,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

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
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/stats');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-400">You don't have permission to access the admin dashboard.</p>
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
    { href: '/admin/content', label: 'Content Moderation', icon: Shield, description: 'Review reported posts and comments' },
    { href: '/admin/groups', label: 'Group Moderation', icon: Users, description: 'Feature, pin, or hide groups' },
    { href: '/admin/events', label: 'Event Moderation', icon: Calendar, description: 'Feature, pin, or hide events' },
    { href: '/admin/compliance', label: 'GDPR & UK Compliance', icon: Shield, description: 'Consent ledger, DSARs, and UK/EU readiness' },
    { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileText, description: 'Review compliance exports and deletions' },
    { href: '/admin/jobs', label: 'Job Management', icon: Briefcase, description: 'Approve, feature, or remove job listings' },
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard, description: 'Manage user subscriptions' },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, description: 'Platform metrics and insights' },
    { href: '/admin/marketing', label: 'Marketing', icon: Megaphone, description: 'Campaigns, funnel, and growth programs' },
    { href: '/admin/gtm', label: 'Go-to-Market', icon: Target, description: 'Launch readiness and activation tracking' },
    { href: '/admin/settings', label: 'Settings', icon: Settings, description: 'Platform configuration' },
  ];

  const mrr = ((stats?.subscriptions.pro || 0) * 29) + ((stats?.subscriptions.business || 0) * 99);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">ATHENA Platform Management</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to App</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MRR Card */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-purple-100">Monthly Recurring Revenue</p>
              <p className="text-4xl font-bold">AU${mrr.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-purple-100">ARR</p>
              <p className="text-2xl font-semibold">AU${(mrr * 12).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* User Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Users by Persona</h3>
            <div className="space-y-3">
              {stats?.userBreakdown.byPersona.map((item) => (
                <div key={item.persona} className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                    {item.persona.toLowerCase().replace('_', ' ')}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">{item._count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Users by Role</h3>
            <div className="space-y-3">
              {stats?.userBreakdown.byRole.map((item) => (
                <div key={item.role} className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                    {item.role.toLowerCase()}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">{item._count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                  <link.icon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{link.label}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{link.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
