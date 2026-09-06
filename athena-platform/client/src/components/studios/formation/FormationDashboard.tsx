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

import Link from 'next/link';
import React, { useMemo } from 'react';
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
import { Button, buttonVariants } from '@/components/ui/button';
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
import { useFormations } from '@/lib/hooks';
import AbnLookup from './AbnLookup';

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

interface FormationRegistration {
  id: string;
  businessName?: string | null;
  type: string;
  status: string;
  abn?: string | null;
  acn?: string | null;
  data?: Record<string, unknown> | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
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

function normalizeBusinessStatus(status: string): BusinessStatus {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'registered';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'ADDITIONAL_INFO_REQUIRED':
    case 'NEEDS_INFO':
      return 'pending-approval';
    case 'DETAILS_COMPLETE':
    case 'PEOPLE_ADDED':
    case 'ADDRESS_VERIFIED':
    case 'DOCUMENTS_UPLOADED':
    case 'PAYMENT_PENDING':
    case 'PAYMENT_COMPLETE':
    case 'PENDING_PAYMENT':
    case 'PAID':
      return 'in-progress';
    default:
      return 'draft';
  }
}

function normalizeBusinessType(type: string): Business['type'] {
  switch (type) {
    case 'COMPANY':
      return 'Corporation';
    case 'PARTNERSHIP':
      return 'Partnership';
    case 'TRUST':
      return 'Non-Profit';
    default:
      return 'Sole Proprietor';
  }
}

function getProgressForStatus(status: string): number {
  const progress: Record<string, number> = {
    DRAFT: 10,
    DETAILS_COMPLETE: 25,
    PEOPLE_ADDED: 40,
    ADDRESS_VERIFIED: 55,
    DOCUMENTS_UPLOADED: 70,
    PAYMENT_PENDING: 75,
    PENDING_PAYMENT: 75,
    PAYMENT_COMPLETE: 85,
    PAID: 85,
    SUBMITTED: 90,
    UNDER_REVIEW: 95,
    ADDITIONAL_INFO_REQUIRED: 80,
    NEEDS_INFO: 80,
    APPROVED: 100,
    COMPLETED: 100,
    REJECTED: 100,
  };

  return progress[status] ?? 0;
}

function pickString(source: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function mapRegistrationToBusiness(registration: FormationRegistration): Business {
  const data = registration.data && typeof registration.data === 'object' ? registration.data : null;

  return {
    id: registration.id,
    name: registration.businessName || 'Untitled registration',
    type: normalizeBusinessType(registration.type),
    status: normalizeBusinessStatus(registration.status),
    state: pickString(data, ['state', 'jurisdiction', 'country']) || 'Not specified',
    formationProgress: getProgressForStatus(registration.status),
    createdAt: registration.createdAt ? new Date(registration.createdAt) : new Date(),
    ein: registration.abn || registration.acn || undefined,
    registrationNumber: registration.acn || registration.abn || undefined,
  };
}

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
          <Link
            href={`/dashboard/formation/${business.id}`}
            className={cn(buttonVariants({ variant: 'default' }), 'flex-1')}
          >
            Continue Formation
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
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
  const { data: registrations, isLoading, error } = useFormations();
  const registrationList: FormationRegistration[] = Array.isArray(registrations)
    ? registrations
    : [];
  const businesses = useMemo(
    () => registrationList.map(mapRegistrationToBusiness),
    [registrationList]
  );
  const business = businesses[0] ?? null;
  const cofounderMatches: CofounderMatch[] = [];
  const complianceItems: ComplianceItem[] = [];

  const completedCompliance = complianceItems.filter(item => item.status === 'complete').length;
  const overdueCompliance = complianceItems.filter(item => item.status === 'overdue').length;
  const inProgressCount = registrationList.filter((registration) =>
    ['DRAFT', 'DETAILS_COMPLETE', 'PEOPLE_ADDED', 'ADDRESS_VERIFIED', 'DOCUMENTS_UPLOADED'].includes(registration.status)
  ).length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Formation Studio</h1>
          <p className="text-muted-foreground">Build and manage your business</p>
        </div>
        <Link href="/dashboard/formation/new" className={buttonVariants({ variant: 'default' })}>
          <Plus className="h-4 w-4 mr-2" />
          Start New Business
        </Link>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            Formation registrations could not be loaded. Please try again shortly.
          </CardContent>
        </Card>
      )}

      <AbnLookup />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Businesses"
          value={isLoading ? '...' : businesses.length}
          description={inProgressCount > 0 ? `${inProgressCount} in formation` : 'No active registrations'}
          icon={Building2}
        />
        <StatCard
          title="Co-founder Matches"
          value={0}
          description="Matching not configured"
          icon={Users}
        />
        <StatCard
          title="Compliance"
          value={complianceItems.length ? `${completedCompliance}/${complianceItems.length}` : 'Not configured'}
          description={overdueCompliance > 0 ? `${overdueCompliance} overdue` : 'No live checklist'}
          icon={FileCheck}
        />
        <StatCard
          title="Est. Setup Cost"
          value="--"
          description="Shown after checkout setup"
          icon={DollarSign}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Card - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading registrations...
              </CardContent>
            </Card>
          ) : business ? (
            <BusinessCard business={business} />
          ) : (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg">No registrations yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start a registration to see formation progress, documents, and status here.
                </p>
                <Link
                  href="/dashboard/formation/new"
                  className={cn(buttonVariants({ variant: 'default' }), 'mt-4')}
                >
                  Start New Business
                </Link>
              </CardContent>
            </Card>
          )}

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
              {complianceItems.length > 0 ? (
                <ComplianceChecklist items={complianceItems} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Compliance checklist data is not connected for this dashboard yet.
                </p>
              )}
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
              {cofounderMatches.length > 0 ? (
                cofounderMatches.map((match) => (
                  <CofounderMatchCard key={match.id} match={match} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Co-founder matching is not connected yet.
                </p>
              )}
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
                Review your region-specific registration, tax, licensing, and reporting obligations before submitting formation documents.
              </p>
              <Link href="/dashboard/formation/new" className="mt-2 inline-flex text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
                Continue setup →
              </Link>
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
