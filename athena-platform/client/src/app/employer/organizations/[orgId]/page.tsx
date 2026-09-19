'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Building2,
  Briefcase,
  GraduationCap,
  Users,
  FileText,
  TrendingUp,
  Settings,
  Plus,
  Eye,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  Clock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { looksLikeAbn, verificationApi, type VerificationBadge } from '@/lib/verification-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  activeJobs: number;
  totalJobs: number;
  teamMembers: number;
  totalApplications: number;
  recentApplications: number;
  totalViews: number;
  applicationsByStatus: Record<string, number>;
}

interface DashboardData {
  organization: any;
  stats: DashboardStats;
}

export default function OrganizationDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['employer-dashboard', orgId],
    queryFn: async () => {
      const response = await api.get(`/employer/organizations/${orgId}/dashboard`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const { organization, stats } = data;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back Button */}
      <Link
        href="/employer"
        className="inline-flex items-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        All Organizations
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            {organization.logo ? (
              <img src={organization.logo} alt={organization.name} className="w-full h-full rounded-xl object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-white" />
            )}
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
              {organization.name}
              {organization.isVerified && <ShieldCheck className="h-5 w-5 text-emerald-600" aria-label="Verified organisation" />}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 capitalize">
              {organization.type} • {organization.city}, {organization.state}
            </p>
          </div>
        </div>
        <Link href={`/employer/organizations/${orgId}/jobs/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Post New Job
          </Button>
        </Link>
      </div>

      <OrganisationVerification orgId={orgId} organization={organization} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeJobs}</p>
              <p className="text-sm text-slate-500">Active Jobs</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalApplications}</p>
              <p className="text-sm text-slate-500">Applications</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Eye className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalViews}</p>
              <p className="text-sm text-slate-500">Job Views</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.teamMembers}</p>
              <p className="text-sm text-slate-500">Team Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Application Pipeline */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Application Pipeline
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { status: 'PENDING', label: 'Pending', icon: Clock, color: 'yellow' },
            { status: 'REVIEWED', label: 'Reviewed', icon: Eye, color: 'blue' },
            { status: 'SHORTLISTED', label: 'Shortlisted', icon: CheckCircle, color: 'green' },
            { status: 'INTERVIEW', label: 'Interview', icon: Users, color: 'purple' },
            { status: 'REJECTED', label: 'Rejected', icon: XCircle, color: 'red' },
          ].map(({ status, label, icon: Icon, color }) => (
            <div
              key={status}
              className={`p-4 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 text-${color}-600`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.applicationsByStatus[status] || 0}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={`/employer/organizations/${orgId}/jobs`}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-slate-900 dark:text-white">Manage Jobs</span>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </Link>
        <Link
          href={`/employer/organizations/${orgId}/applications`}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-green-600" />
              <span className="font-medium text-slate-900 dark:text-white">Applications</span>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </Link>
        <Link
          href={`/employer/organizations/${orgId}/apprenticeships`}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-rose-600" />
              <span className="font-medium text-slate-900 dark:text-white">Apprenticeships</span>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </Link>
        <Link
          href={`/employer/organizations/${orgId}/team`}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-slate-900 dark:text-white">Team</span>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </Link>
        <Link
          href={`/employer/organizations/${orgId}/analytics`}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-slate-900 dark:text-white">Analytics</span>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </Link>

        {(organization.type === 'university' || organization.type === 'tafe') && (
          <>
            <Link
              href={`/employer/organizations/${orgId}/education/courses`}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-slate-900 dark:text-white">Courses</span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </Link>
            <Link
              href={`/employer/organizations/${orgId}/education/applications`}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-slate-900 dark:text-white">Education Apps</span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </Link>
            <Link
              href={`/employer/organizations/${orgId}/education/outcomes`}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-slate-900 dark:text-white">Education Outcomes</span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The Verified mark members see in the companies and providers directories.
 * An owner or admin applies here with the ABN and website a person checks
 * against ABN Lookup; approving that badge marks the organisation verified.
 */
function OrganisationVerification({ orgId, organization }: { orgId: string; organization: { name: string; type?: string | null; website?: string | null; isVerified?: boolean } }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [abn, setAbn] = useState('');
  const [website, setWebsite] = useState(organization.website ?? '');

  const badges = useQuery({
    queryKey: ['verification-badges'],
    queryFn: () => verificationApi.myBadges(),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as VerificationBadge[]) : []),
    enabled: !organization.isVerified,
  });

  const request = badges.data
    ?.filter((b) => (b.type === 'EMPLOYER' || b.type === 'EDUCATOR') && b.metadata?.organizationId === orgId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

  const apply = useMutation({
    mutationFn: () => verificationApi.applyForOrganisation(organization.type, { organizationId: orgId, organizationName: organization.name, abn: abn.replace(/\s+/g, ''), website: website.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-badges'] });
      setOpen(false);
      toast.success('Sent. A person will check the ABN and tell you when it is done.');
    },
    onError: (e) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not send that'),
  });

  if (organization.isVerified) {
    return (
      <div className="mb-8 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        <p>
          <span className="font-medium">Verified.</span> Members see the mark beside {organization.name} in the directory and on its jobs and courses.
        </p>
      </div>
    );
  }

  if (request?.status === 'PENDING') {
    return (
      <div className="mb-8 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
        <Clock className="h-5 w-5 shrink-0 text-amber-600" />
        <p>
          <span className="font-medium">Verification requested</span> {formatDistanceToNow(new Date(request.submittedAt), { addSuffix: true })}. A person checks the ABN against the public register; we will tell you when it is done.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <ShieldCheck className="h-5 w-5 text-slate-400" /> Get verified
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">A Verified mark beside your name tells members a person has checked your ABN. It takes a few minutes to ask for.</p>
          {request?.status === 'REJECTED' && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-red-600">
              <XCircle className="h-3.5 w-3.5" /> Not approved{request.reason ? ` · ${request.reason}` : ''}. You can apply again.
            </p>
          )}
        </div>
        {!open && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            {request?.status === 'REJECTED' ? 'Apply again' : 'Apply for verification'}
          </Button>
        )}
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!looksLikeAbn(abn)) {
              toast.error('An ABN is eleven digits.');
              return;
            }
            apply.mutate();
          }}
          className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-700 md:grid-cols-2"
        >
          <div>
            <label htmlFor="org-abn" className="block text-xs font-medium text-slate-600 dark:text-slate-300">ABN</label>
            <input id="org-abn" required inputMode="numeric" value={abn} onChange={(e) => setAbn(e.target.value)} placeholder="11 digits" maxLength={14} className="input mt-1 w-full text-sm" />
          </div>
          <div>
            <label htmlFor="org-website" className="block text-xs font-medium text-slate-600 dark:text-slate-300">Website</label>
            <input id="org-website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="input mt-1 w-full text-sm" />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={apply.isPending}>
              {apply.isPending ? 'Sending…' : 'Send for checking'}
            </Button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
            <span className="text-xs text-slate-500">Only an owner or admin of the organisation can ask.</span>
          </div>
        </form>
      )}
    </div>
  );
}
