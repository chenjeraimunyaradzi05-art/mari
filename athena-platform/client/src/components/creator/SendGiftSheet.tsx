'use client';

/**
 * A gift to a creator from her profile.
 *
 * Members could buy points (TopUpModal) but the only place to spend them was
 * a live stream. POST /api/creator/gifts/send is the real transaction: it
 * checks the receiver is a monetized creator, debits the sender's points and
 * credits the creator's share. This is the sheet a profile opens to send one.
 *
 * The balance is the member's own, read from /creator/balance and refetched
 * after a gift or a top-up; nothing here is estimated.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Coins, Loader2 } from 'lucide-react';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { TopUpModal } from '@/components/creator/TopUpModal';
import { creatorApi } from '@/lib/api';
import { apiMessage } from '@/lib/strategy-api';
import { cn } from '@/lib/utils';

export interface GiftOption {
  id: string;
  name: string;
  value: number;
  icon: string;
  description?: string;
}

/** Shared with anything else that shows the member's gift points. */
export const GIFT_BALANCE_QUERY_KEY = ['creator-balance'] as const;

interface SendGiftSheetProps {
  isOpen: boolean;
  onClose: () => void;
  receiverId: string;
  receiverName: string;
}

export function SendGiftSheet({ isOpen, onClose, receiverId, receiverName }: SendGiftSheetProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<GiftOption | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const { data: gifts = [] } = useQuery({
    queryKey: ['creator-gifts'],
    queryFn: () => creatorApi.getGifts(),
    enabled: isOpen,
    staleTime: 60 * 60 * 1000,
    select: (res) => (Array.isArray(res.data?.data) ? (res.data.data as GiftOption[]) : []),
  });

  const {
    data: balance,
    isLoading: balanceLoading,
    isError: balanceFailed,
  } = useQuery({
    queryKey: GIFT_BALANCE_QUERY_KEY,
    queryFn: () => creatorApi.getBalance(),
    enabled: isOpen,
    select: (res) => Number(res.data?.data?.balance) || 0,
  });

  const points = balance ?? 0;
  const short = selected ? Math.max(0, selected.value - points) : 0;
  const ready = !balanceLoading && !balanceFailed;
  const canSend = selected !== null && short === 0 && ready && !sending;

  const refreshBalance = () => queryClient.invalidateQueries({ queryKey: GIFT_BALANCE_QUERY_KEY });

  const send = async () => {
    // The button is disabled when short, and this guard keeps a stale click
    // from posting a gift the balance cannot cover.
    if (!selected || short > 0 || !ready || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = note.trim();
      await creatorApi.sendGift({ receiverId, giftType: selected.id, ...(message ? { message } : {}) });
      toast.success(`${selected.icon} ${selected.name} sent to ${receiverName}.`);
      await refreshBalance();
      setSelected(null);
      setNote('');
      onClose();
    } catch (err) {
      setError(apiMessage(err, 'The gift could not be sent. Try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`A gift for ${receiverName}`}
        description="A small thank-you that lands in her earnings. Creators keep most of what a gift is worth; the rest is the platform fee."
      >
        <ModalContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Coins className="h-4 w-4 text-amber-500" />
              {balanceLoading
                ? 'Checking your points…'
                : balanceFailed
                  ? 'Your points could not be read just now.'
                  : `You have ${points} ${points === 1 ? 'point' : 'points'}`}
            </span>
            <button
              type="button"
              onClick={() => setTopUpOpen(true)}
              className="font-medium text-rose-600 hover:underline dark:text-rose-400"
            >
              Top up
            </button>
          </div>

          {gifts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">The gifts are on their way.</p>
          ) : (
            <fieldset>
              <legend className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Choose a gift</legend>
              <div className="grid grid-cols-3 gap-2">
                {gifts.map((gift) => (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => {
                      setSelected(gift);
                      setError(null);
                    }}
                    aria-pressed={selected?.id === gift.id}
                    disabled={sending}
                    className={cn(
                      'rounded-xl border px-2 py-3 text-center text-xs transition',
                      selected?.id === gift.id
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    )}
                  >
                    <span className="block text-2xl">{gift.icon}</span>
                    <span className="block font-medium text-slate-900 dark:text-white">{gift.name}</span>
                    <span className="block text-slate-500">{gift.value} pts</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {selected && short > 0 && ready && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              A {selected.name} needs {short} more {short === 1 ? 'point' : 'points'} than you have. Top up above and it is yours to send.
            </p>
          )}

          <div>
            <label htmlFor="gift-note" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Add a note (optional)
            </label>
            <textarea
              id="gift-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              maxLength={200}
              rows={2}
              disabled={sending}
              placeholder="What her work meant to you"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{note.length}/200</p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={sending}>
              Not now
            </Button>
            <Button type="button" className="flex-1" onClick={() => void send()} disabled={!canSend}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {sending ? 'Sending…' : selected ? `Send ${selected.name}` : 'Send'}
            </Button>
          </div>
        </ModalContent>
      </Modal>

      {topUpOpen && (
        <TopUpModal
          isOpen={topUpOpen}
          onClose={() => setTopUpOpen(false)}
          onTopped={() => void refreshBalance()}
        />
      )}
    </>
  );
}

export default SendGiftSheet;
