'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Check, Loader2, MailOpen, ShieldOff, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

/**
 * The invitations waiting for her answer.
 *
 * The invite notification has always linked here, and there was no page: the
 * server grew a pending, accept and decline flow, and the invitee had no way to
 * see who had asked for her or to say yes or no. An invitation grants nothing
 * until it is accepted, so an unanswered one is harmless — but a woman should
 * be able to find out which organisation has put her name on a list, and to
 * make sure it cannot do so again.
 */

interface Invitation {
  id: string;
  invitedAt: string;
  role: string;
  permissions: { canPostJobs: boolean; canManageTeam: boolean; canViewAnalytics: boolean };
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    city: string | null;
    state: string | null;
  };
}

const ROLE_WORDS: Record<string, string> = {
  ADMIN: 'an admin',
  RECRUITER: 'a recruiter',
  VIEWER: 'a viewer',
};

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

function describeAccess(invitation: Invitation): string {
  const parts: string[] = [];
  if (invitation.permissions.canPostJobs) parts.push('post jobs and see applicants');
  if (invitation.permissions.canManageTeam) parts.push('manage the team');
  if (invitation.permissions.canViewAnalytics) parts.push('see hiring analytics');
  return parts.length ? `You would be able to ${parts.join(', ')}.` : 'You would be able to see the organisation’s console.';
}

export default function EmployerInvitationsPage() {
  const queryClient = useQueryClient();

  const invitations = useQuery<Invitation[]>({
    queryKey: ['employer-invitations'],
    queryFn: async () => (await api.get('/employer/invitations')).data.data,
  });

  const accept = useMutation({
    mutationFn: async (id: string) => (await api.post(`/employer/invitations/${id}/accept`)).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employer-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['employer-organizations'] });
      toast.success(result?.message || 'You have joined the organisation.');
    },
    onError: (error) => toast.error(errorMessage(error) || 'That did not go through. Try again.'),
  });

  const decline = useMutation({
    mutationFn: async ({ id, block }: { id: string; block: boolean }) =>
      (await api.post(`/employer/invitations/${id}/decline`, { block })).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employer-invitations'] });
      toast.success(result?.message || 'Invitation declined.');
    },
    onError: (error) => toast.error(errorMessage(error) || 'That did not go through. Try again.'),
  });

  const busy = accept.isPending || decline.isPending;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <MailOpen className="h-7 w-7 text-blue-600" />
          Team invitations
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Organisations that have asked you to join their hiring team. Nothing changes until you
          accept, and you do not appear on their team unless you do.
        </p>
      </div>

      {invitations.isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : invitations.isError ? (
        <div className="card text-center">
          <p className="mb-3 text-slate-700 dark:text-slate-200">We could not load your invitations.</p>
          <p className="mb-4 text-sm text-slate-500">
            This is a problem on our side or with the connection. It does not mean you have none.
          </p>
          <Button variant="outline" onClick={() => invitations.refetch()}>
            Try again
          </Button>
        </div>
      ) : (invitations.data?.length ?? 0) === 0 ? (
        <div className="card text-center">
          <p className="text-slate-700 dark:text-slate-200">You have no invitations waiting.</p>
          <Link href="/employer" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go to the employer console
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {invitations.data!.map((invitation) => {
            const place = [invitation.organization.city, invitation.organization.state].filter(Boolean).join(', ');
            return (
              <li key={invitation.id} className="card space-y-4">
                <div className="flex items-start gap-4">
                  {invitation.organization.logo ? (
                    <img
                      src={invitation.organization.logo}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Building2 className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-900 dark:text-white">
                      {invitation.organization.name}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {place ? `${place} · ` : ''}Invited {new Date(invitation.invitedAt).toLocaleDateString()} to join as{' '}
                      {ROLE_WORDS[invitation.role] ?? invitation.role.toLowerCase()}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{describeAccess(invitation)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => accept.mutate(invitation.id)} disabled={busy}>
                    <Check className="mr-2 h-4 w-4" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decline.mutate({ id: invitation.id, block: false })}
                    disabled={busy}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Decline
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Decline, and block the people who run this organisation? They will not be able to invite you again, and the block works as any other block on ATHENA does. You can lift it from your Safety Centre.'
                        )
                      ) {
                        decline.mutate({ id: invitation.id, block: true });
                      }
                    }}
                    disabled={busy}
                  >
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Decline and block
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
