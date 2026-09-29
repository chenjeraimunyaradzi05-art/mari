'use client';

/**
 * Asking a provider for a place on a course that has a fee.
 *
 * On a course with a provider and a fee, enrolling used to open every lesson
 * and finishing them issued a certificate in the provider's name, while the
 * page said the fee "is arranged with the provider" — so a provider who put a
 * paid course here was giving it away. The lessons now wait for the provider
 * to confirm a place, which is the same yes the provider's console gives an
 * application. This panel is the learner's side of that: what the fee is and
 * who takes it, what asking shares, and where her request stands.
 *
 * ATHENA takes no payment for courses. Nothing here pretends otherwise.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRight, Hourglass, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api';

export type CourseAccessReason =
  | 'EDITOR'
  | 'OPEN_COURSE'
  | 'NOT_ENROLLED'
  | 'ADMITTED'
  | 'ENROLLED_BEFORE_RULE'
  | 'AWAITING_PROVIDER'
  | 'NOT_OFFERED'
  | 'NOT_REQUESTED';

/** As GET /api/courses/:slug and GET /api/courses/me return it. */
export type CourseAccess = {
  requiresAdmission: boolean;
  lessonsOpen: boolean;
  admitted: boolean;
  place: { applicationId: string; status: string } | null;
  reason: CourseAccessReason;
};

/** True when the lessons are waiting on the provider, which is when this panel shows. */
export function waitsForProvider(access: CourseAccess | null | undefined): access is CourseAccess {
  return Boolean(access && access.requiresAdmission && !access.lessonsOpen);
}

const money = (n: number) => `$${new Intl.NumberFormat('en-AU').format(n)}`;

function apiMessage(error: unknown): string {
  const payload = (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return payload?.message || payload?.error || '';
}

export function CoursePlacePanel({
  courseId,
  provider,
  cost,
  access,
}: {
  courseId: string;
  provider: string;
  cost: number | null | undefined;
  access: CourseAccess;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const ask = useMutation({
    mutationFn: (requestPlace: boolean) => api.post(`/courses/${courseId}/enroll`, { requestPlace }),
    onSuccess: (response, requestPlace) => {
      queryClient.invalidateQueries({ queryKey: ['course'] });
      queryClient.invalidateQueries({ queryKey: ['my-courses'] });
      queryClient.invalidateQueries({ queryKey: ['my-education-applications'] });
      const next = (response.data?.data?.access ?? null) as CourseAccess | null;
      if (next?.lessonsOpen) {
        router.push(`/dashboard/learn/${courseId}/classroom`);
        return;
      }
      toast.success(requestPlace ? `Asked. ${provider} will see your request.` : 'Saved to your courses.');
    },
    onError: (error) => toast.error(apiMessage(error) || 'That did not go through. Nothing was sent. Try again in a moment.'),
  });

  const fee = typeof cost === 'number' && cost > 0 ? money(cost) : null;
  const feeLine = fee
    ? `${provider} charges ${fee} for this course. You arrange it with them directly; ATHENA does not take payment for courses.`
    : `This course has a fee, which you arrange with ${provider} directly; ATHENA does not take payment for courses.`;

  if (access.reason === 'ADMITTED') {
    // Accepted, and not yet enrolled: she applied from the provider's page.
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700 dark:text-slate-200">{provider} has confirmed your place. The lessons are ready for you.</p>
        <button
          type="button"
          onClick={() => ask.mutate(false)}
          disabled={ask.isPending}
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Open the classroom
        </button>
      </div>
    );
  }

  if (access.reason === 'AWAITING_PROVIDER') {
    return (
      <div className="space-y-3" role="status">
        <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
          <Hourglass className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          You have asked {provider} for a place. The lessons open here as soon as they confirm it, and you will be told in your notifications.
        </p>
        <p className="text-xs text-slate-500">{feeLine}</p>
        <Link href="/dashboard/learn/applications" className="block text-center text-sm text-primary-600 hover:underline">
          Follow your request
        </Link>
      </div>
    );
  }

  const again = access.reason === 'NOT_OFFERED';
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {again
          ? `${provider} did not offer you a place last time. The previews stay open, and you can ask again.`
          : `The previews are open now. The other lessons open here once ${provider} confirms your place.`}
      </p>
      <p className="text-xs text-slate-500">{feeLine}</p>
      {/* Said on the button's own panel, before she presses it: asking is an
          application, and an application shows the provider who she is. */}
      <p className="text-xs text-slate-500">
        Asking sends {provider} your name, email address, photo and headline, so they can arrange your place and the fee with you.
      </p>
      <button
        type="button"
        onClick={() => ask.mutate(true)}
        disabled={ask.isPending}
        className="btn-primary flex w-full items-center justify-center gap-2"
      >
        {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {again ? 'Ask again' : `Ask ${provider} for a place`}
      </button>
    </div>
  );
}
