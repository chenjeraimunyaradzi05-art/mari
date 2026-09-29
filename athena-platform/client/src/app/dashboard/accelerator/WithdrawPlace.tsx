'use client';

/**
 * Leaving a cohort.
 *
 * There was no way for a founder to give up her place. An unpaid place sat on
 * a seat until staff released it by hand, and a paid one could only be ended
 * by writing to the team. This is the founder's side of
 * POST /api/business/accelerators/enrollments/:id/withdraw: an unpaid place is
 * given up at once, and a paid one ends and the team is told her fee needs a
 * decision. The confirmation says exactly that and no more — leaving does not
 * by itself mean a refund, so nothing here says it does.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { apiMessage } from '@/lib/strategy-api';

export function WithdrawPlace({
  enrollmentId,
  cohortName,
  paid,
  onDone,
}: {
  enrollmentId: string;
  cohortName: string;
  paid: boolean;
  /** `removed` is true when the place no longer exists at all (an unpaid place is deleted). */
  onDone: (removed: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const withdraw = async () => {
    setPending(true);
    try {
      const res = await api.post(`/business/accelerators/enrollments/${enrollmentId}/withdraw`);
      toast.success((res.data?.message as string | undefined) || 'You have left this cohort.');
      setConfirming(false);
      onDone(res.data?.data?.withdrawn === true);
    } catch (err) {
      // The server's refusals are specific (a payment still going through, a
      // cohort already completed), so they are shown as sent.
      toast.error(apiMessage(err, 'You have not left the cohort. Your place is as it was.'));
    } finally {
      setPending(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 hover:underline"
      >
        <LogOut className="h-3.5 w-3.5" /> Leave this cohort
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800" role="group" aria-label={`Leave ${cohortName}`}>
      <p className="text-slate-700 dark:text-slate-200">
        {paid
          ? `Leave ${cohortName}? Your place ends now. You paid for it, so ATHENA's team is told and will contact you about your fee; leaving does not by itself mean a refund.`
          : `Leave ${cohortName}? Your place is given up now so someone else can take it. You have not been charged.`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={withdraw} disabled={pending} className="btn-primary px-3 py-1.5 text-sm">
          {pending ? 'Leaving...' : 'Leave the cohort'}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="btn-secondary px-3 py-1.5 text-sm">
          Stay
        </button>
      </div>
    </div>
  );
}

export default WithdrawPlace;
