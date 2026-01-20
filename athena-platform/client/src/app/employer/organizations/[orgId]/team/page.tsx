'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  MoreVertical,
  Trash2,
  ArrowLeft,
  Crown,
  Eye,
  Briefcase,
  Settings,
  X,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface TeamMember {
  id: string;
  role: string;
  permissions: {
    canPostJobs: boolean;
    canManageTeam: boolean;
    canViewAnalytics: boolean;
  };
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile: {
      avatar: string | null;
    } | null;
  };
}

const roleConfig: Record<string, { label: string; color: string; icon: any; description: string }> = {
  OWNER: {
    label: 'Owner',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Crown,
    description: 'Full control over organization and billing',
  },
  ADMIN: {
    label: 'Admin',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Shield,
    description: 'Can manage jobs, applications, and team members',
  },
  RECRUITER: {
    label: 'Recruiter',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: Briefcase,
    description: 'Can post jobs and manage applications',
  },
  VIEWER: {
    label: 'Viewer',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: Eye,
    description: 'Read-only access to view analytics',
  },
};

export default function TeamPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const orgId = params.orgId as string;

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('RECRUITER');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['employer-team', orgId],
    queryFn: async () => {
      const response = await api.get(`/employer/organizations/${orgId}/team`);
      return response.data;
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const response = await api.post(`/employer/organizations/${orgId}/team/invite`, { email, role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-team', orgId] });
      toast.success('Team member invited successfully!');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('RECRUITER');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to invite member');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await api.delete(`/employer/organizations/${orgId}/team/${memberId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-team', orgId] });
      toast.success('Team member removed');
      setMenuOpen(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    },
  });

  const members: TeamMember[] = teamData?.data?.members || [];
  const currentUserPermissions = teamData?.data?.currentUserPermissions || {};
  const canManageTeam = currentUserPermissions.canManageTeam;

  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { OWNER: 0, ADMIN: 1, RECRUITER: 2, VIEWER: 3 };
    return (roleOrder[a.role as keyof typeof roleOrder] || 4) - (roleOrder[b.role as keyof typeof roleOrder] || 4);
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <Link
        href={`/employer/organizations/${orgId}`}
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-7 w-7 text-blue-600" />
            Team Members
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage who has access to your organization
          </p>
        </div>
        {canManageTeam && (
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Role Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(roleConfig).map(([role, config]) => {
          const Icon = config.icon;
          const count = members.filter((m) => m.role === role).length;
          return (
            <div
              key={role}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-5 w-5 text-gray-500" />
                <span className="font-medium text-gray-900 dark:text-white">{config.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{config.description}</p>
            </div>
          );
        })}
      </div>

      {/* Team List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No team members yet
            </h3>
            <p className="text-gray-500">Invite colleagues to collaborate on hiring</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedMembers.map((member) => {
              const config = roleConfig[member.role];
              const Icon = config.icon;

              return (
                <div key={member.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      {member.user.profile?.avatar ? (
                        <img
                          src={member.user.profile.avatar}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-medium text-gray-500">
                          {member.user.firstName[0]}
                          {member.user.lastName[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {member.user.firstName} {member.user.lastName}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.user.email}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Joined {formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Permissions & Actions */}
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-2">
                      {member.permissions.canPostJobs && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                          Post Jobs
                        </span>
                      )}
                      {member.permissions.canManageTeam && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                          Manage Team
                        </span>
                      )}
                      {member.permissions.canViewAnalytics && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                          View Analytics
                        </span>
                      )}
                    </div>

                    {canManageTeam && member.role !== 'OWNER' && (
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-500" />
                        </button>

                        {menuOpen === member.id && (
                          <div className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <button
                              onClick={() => removeMemberMutation.mutate(member.id)}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove from team
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invite Team Member</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMemberMutation.mutate({ email: inviteEmail, role: inviteRole });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input w-full"
                  placeholder="colleague@company.com"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  They must have an existing ATHENA account
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <div className="space-y-2">
                  {['ADMIN', 'RECRUITER', 'VIEWER'].map((role) => {
                    const config = roleConfig[role];
                    const Icon = config.icon;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setInviteRole(role)}
                        className={`w-full p-3 rounded-lg border-2 text-left transition ${
                          inviteRole === role
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-gray-500" />
                          <span className="font-medium text-gray-900 dark:text-white">{config.label}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={inviteMemberMutation.isPending || !inviteEmail}
                >
                  {inviteMemberMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    'Send Invite'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
