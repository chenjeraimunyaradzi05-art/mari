'use client';

/**
 * Formation Studio Dashboard
 * Phase 4: Web Client - Persona Studios
 * Step 61: Entrepreneur business health overview
 * 
 * Landing page showing:
 * - Business registration status
 * - Formation progress tracker
 * - Co-founder matches
 * - Compliance checklist
 * - Financial overview
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Building2,
  Users,
  FileCheck,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  Briefcase,
  Shield,
  Calendar,
  Target,
  Zap,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================
// TYPES
// ============================================

type BusinessStatus = 'draft' | 'in-progress' | 'pending-approval' | 'registered' | 'active';

interface Business {
  id: string;
  name: string;
  type: 'LLC' | 'Corporation' | 'Sole Proprietor' | 'Partnership' | 'Non-Profit';
  status: BusinessStatus;
  state: string;
  formationProgress: number;
  createdAt: Date;
  ein?: string;
  registrationNumber?: string;
}

interface CofounderMatch {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  matchScore: number;
  skills: string[];
  status: 'pending' | 'connected' | 'declined';
}

interface ComplianceItem {
  id: string;
  title: string;
  description: string;
  dueDate?: Date;
  status: 'complete' | 'pending' | 'overdue' | 'upcoming';
  priority: 'high' | 'medium' | 'low';
}

interface FormationDashboardProps {
  className?: string;
}

// ============================================
// STATUS CONFIG
// ============================================

const STATUS_CONFIG: Record<BusinessStatus, { label: string; color: string; icon: React.ElementType }> = {
  'draft': { label: 'Draft', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', icon: Clock },
  'in-progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  'pending-approval': { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  'registered': { label: 'Registered', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  'active': { label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
};

const COMPLIANCE_STATUS_CONFIG = {
  complete: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  pending: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  overdue: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  upcoming: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
};

// ============================================
// MOCK DATA
// ============================================

const mockBusiness: Business = {
  id: '1',
  name: 'TechVenture Labs LLC',
  type: 'LLC',
  status: 'in-progress',
  state: 'Delaware',
  formationProgress: 65,
  createdAt: new Date('2026-01-10'),
  ein: '12-3456789',
};

const mockCofounderMatches: CofounderMatch[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    avatar: '/avatars/sarah.jpg',
    role: 'Technical Co-founder',
    matchScore: 94,
    skills: ['Full-Stack Development', 'AI/ML', 'System Architecture'],
    status: 'pending',
  },
  {
    id: '2',
    name: 'Marcus Johnson',
    avatar: '/avatars/marcus.jpg',
    role: 'Marketing Co-founder',
    matchScore: 89,
    skills: ['Growth Marketing', 'Brand Strategy', 'B2B Sales'],
    status: 'connected',
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    avatar: '/avatars/elena.jpg',
    role: 'Operations Co-founder',
    matchScore: 87,
    skills: ['Operations', 'Finance', 'HR'],
    status: 'pending',
  },
];

const mockComplianceItems: ComplianceItem[] = [
  {
    id: '1',
    title: 'Annual Report Filing',
    description: 'File annual report with Delaware Secretary of State',
    dueDate: new Date('2026-03-01'),
    status: 'upcoming',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Registered Agent Fee',
    description: 'Pay annual registered agent service fee',
    dueDate: new Date('2026-02-15'),
    status: 'pending',
    priority: 'medium',
  },
  {
    id: '3',
    title: 'Operating Agreement',
    description: 'Complete and sign LLC operating agreement',
    status: 'complete',
    priority: 'high',
  },
  {
    id: '4',
    title: 'EIN Application',
    description: 'Apply for Employer Identification Number with IRS',
    status: 'complete',
    priority: 'high',
  },
  {
    id: '5',
    title: 'Business License',
    description: 'Obtain local business license',
    dueDate: new Date('2026-01-10'),
    status: 'overdue',
    priority: 'high',
  },
];

// ============================================
// COMPONENTS
// ============================================

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </div>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-sm',
              trend.positive ? 'text-emerald-600' : 'text-red-600'
            )}>
              <TrendingUp className={cn('h-4 w-4', !trend.positive && 'rotate-180')} />
              {trend.value}%
            </div>
          )}
        </div>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BusinessCard({ business }: { business: Business }) {
  const status = STATUS_CONFIG[business.status];
  const StatusIcon = status.icon;

  return (
    <Card className="overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-emerald-500 to-emerald-600" />
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{business.name}</h3>
              <p className="text-sm text-muted-foreground">
                {business.type} • {business.state}
              </p>
            </div>
          </div>
          <Badge className={status.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Formation Progress</span>
              <span className="font-medium">{business.formationProgress}%</span>
            </div>
            <Progress value={business.formationProgress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">EIN</p>
              <p className="font-medium">{business.ein || 'Pending'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="font-medium">{business.createdAt.toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button className="flex-1" variant="default">
            Continue Formation
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Download Documents</DropdownMenuItem>
              <DropdownMenuItem>Edit Information</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function CofounderMatchCard({ match }: { match: CofounderMatch }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={match.avatar} alt={match.name} />
          <AvatarFallback>{match.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
        </Avatar>
        <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {match.matchScore}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{match.name}</h4>
          {match.status === 'connected' && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-600">
              Connected
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{match.role}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {match.skills.slice(0, 2).map((skill) => (
            <span key={skill} className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              {skill}
            </span>
          ))}
          {match.skills.length > 2 && (
            <span className="text-xs text-muted-foreground">+{match.skills.length - 2}</span>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon">
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function ComplianceChecklist({ items }: { items: ComplianceItem[] }) {
  const getStatusIcon = (status: ComplianceItem['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      case 'overdue':
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'pending':
      case 'upcoming':
        return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border',
            item.status === 'overdue' && 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10'
          )}
        >
          {getStatusIcon(item.status)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={cn(
                'font-medium',
                item.status === 'complete' && 'line-through text-muted-foreground'
              )}>
                {item.title}
              </h4>
              {item.priority === 'high' && item.status !== 'complete' && (
                <Badge variant="destructive" className="text-xs">High Priority</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            {item.dueDate && item.status !== 'complete' && (
              <p className={cn(
                'text-xs mt-1',
                item.status === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'
              )}>
                Due: {item.dueDate.toLocaleDateString()}
              </p>
            )}
          </div>
          {item.status !== 'complete' && (
            <Button variant="ghost" size="sm">
              Complete
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FormationDashboard({ className }: FormationDashboardProps) {
  const [business] = useState<Business>(mockBusiness);
  const [cofounderMatches] = useState<CofounderMatch[]>(mockCofounderMatches);
  const [complianceItems] = useState<ComplianceItem[]>(mockComplianceItems);

  const completedCompliance = complianceItems.filter(item => item.status === 'complete').length;
  const overdueCompliance = complianceItems.filter(item => item.status === 'overdue').length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Formation Studio</h1>
          <p className="text-muted-foreground">Build and manage your business</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Start New Business
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Businesses"
          value={1}
          description="1 in formation"
          icon={Building2}
        />
        <StatCard
          title="Co-founder Matches"
          value={cofounderMatches.length}
          description={`${cofounderMatches.filter(m => m.status === 'connected').length} connected`}
          icon={Users}
        />
        <StatCard
          title="Compliance"
          value={`${completedCompliance}/${complianceItems.length}`}
          description={overdueCompliance > 0 ? `${overdueCompliance} overdue` : 'All on track'}
          icon={FileCheck}
        />
        <StatCard
          title="Est. Setup Cost"
          value="$499"
          description="Formation fees + filings"
          icon={DollarSign}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Card - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <BusinessCard business={business} />

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: FileCheck, label: 'File Documents', color: 'text-blue-600' },
                  { icon: Shield, label: 'Legal Review', color: 'text-purple-600' },
                  { icon: Calendar, label: 'Schedule Consult', color: 'text-emerald-600' },
                  { icon: Target, label: 'Set Milestones', color: 'text-orange-600' },
                ].map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2"
                  >
                    <action.icon className={cn('h-5 w-5', action.color)} />
                    <span className="text-xs">{action.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compliance Checklist */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Compliance Checklist</CardTitle>
                <CardDescription>Stay on top of your legal requirements</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <ComplianceChecklist items={complianceItems} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Co-founder Matches */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Co-founder Matches</CardTitle>
                <CardDescription>Find your perfect partner</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                Find More
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {cofounderMatches.map((match) => (
                <CofounderMatchCard key={match.id} match={match} />
              ))}
            </CardContent>
          </Card>

          {/* Formation Tips */}
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-200 dark:bg-emerald-800">
                  <Zap className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                </div>
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Pro Tip</h3>
              </div>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Delaware LLCs offer strong liability protection and no state corporate income tax 
                for businesses operating outside Delaware. Complete your formation before the end 
                of Q1 to maximize tax benefits.
              </p>
              <Button variant="link" className="p-0 h-auto mt-2 text-emerald-700 dark:text-emerald-300">
                Learn more about LLC benefits →
              </Button>
            </CardContent>
          </Card>

          {/* Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { title: 'LLC Formation Guide', icon: FileCheck },
                { title: 'Tax Planning Checklist', icon: DollarSign },
                { title: 'Legal Templates', icon: Briefcase },
                { title: 'Mentor Sessions', icon: Users },
              ].map((resource) => (
                <Button
                  key={resource.title}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <resource.icon className="h-4 w-4 mr-2" />
                  {resource.title}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default FormationDashboard;
