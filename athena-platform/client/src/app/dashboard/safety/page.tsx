'use client';

/**
 * Safety. For a member in a dangerous situation at home.
 *
 * Everything on this page has existed on the server for some time; this is
 * the first screen that reaches it. Quick exit leaves the site for a
 * harmless page and replaces this one in the history. Safe Mode hides the
 * member from search, closes her messages and keeps notifications vague. Her
 * emergency contacts are told by email when she presses the alert. Safe
 * chats are encrypted, shown under a disguised name, and can be locked with a
 * PIN. Wording throughout stays plain and calm; nothing here should look
 * alarming on a screen someone else might glance at.
 */

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  DoorOpen,
  Eraser,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { dvSafeApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { cn } from '@/lib/utils';

type Contact = { id: string; name: string; phone: string; email?: string; relationship: string; notifyOnPanic: boolean };
type Settings = {
  isSafeMode: boolean;
  hideFromSearch: boolean;
  allowMessages: boolean;
  safeExitEnabled: boolean;
  safeExitUrl: string;
  panicButtonEnabled: boolean;
  notificationsSafe: boolean;
  emergencyContacts: Contact[];
};
type ChatSummary = { id: string; name: string; disguisedName: string; hasPin: boolean; lastActivity: string; messageCount: number };
type ChatMessage = { id: string; senderId: string; content: string; autoDeleteAt?: string; createdAt: string };
type ChatView = ChatSummary & { messages: ChatMessage[] };
type Resource = { name: string; phone: string; website: string; description: string; available: string };

const DEFAULT_EXIT = 'https://www.google.com';
const AUTO_DELETE = [
  { value: 0, label: 'Keep' },
  { value: 60, label: 'Delete after 1 hour' },
  { value: 1440, label: 'Delete after 24 hours' },
  { value: 10080, label: 'Delete after 7 days' },
];
const REGIONS = [
  ['AU', 'Australia'],
  ['NZ', 'New Zealand'],
  ['UK', 'United Kingdom'],
  ['US', 'United States'],
] as const;

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

/** Leaves for a harmless page, and makes Back come here no more. */
function quickExit(url: string) {
  try {
    window.history.replaceState(null, '', '/');
  } catch {
    // Some browsers refuse; leaving still matters more.
  }
  window.location.replace(url || DEFAULT_EXIT);
}

function Toggle({ on, onChange, label, description, disabled }: { on: boolean; onChange: (next: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-slate-900 dark:text-white">{label}</span>
        {description && <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          'relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-50',
          on ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-600'
        )}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', on ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export default function SafetyPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ['dv-safe-settings'],
    queryFn: dvSafeApi.getSettings,
    enabled: isAuthenticated && !authLoading,
    select: (response) => response.data as Settings,
  });
  const chats = useQuery({
    queryKey: ['dv-safe-chats'],
    queryFn: dvSafeApi.listChats,
    enabled: isAuthenticated && !authLoading,
    select: (response) => (Array.isArray(response.data) ? (response.data as ChatSummary[]) : []),
  });
  const [region, setRegion] = useState<string>('AU');
  const resources = useQuery({
    queryKey: ['dv-safe-resources', region],
    queryFn: () => dvSafeApi.resources(region),
    select: (response) => (Array.isArray(response.data) ? (response.data as Resource[]) : []),
  });

  const exitUrl = settings.data?.safeExitUrl || DEFAULT_EXIT;
  const exit = useCallback(() => quickExit(exitUrl), [exitUrl]);

  // Escape leaves, when the member has turned quick exit on.
  useEffect(() => {
    if (!settings.data?.safeExitEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.data?.safeExitEnabled, exit]);

  const refreshSettings = () => queryClient.invalidateQueries({ queryKey: ['dv-safe-settings'] });

  const update = useMutation({
    mutationFn: (data: Record<string, boolean | string>) => dvSafeApi.updateSettings(data),
    onSuccess: refreshSettings,
    onError: (error) => toast.error(errorMessage(error) || 'Could not save that'),
  });
  const enableSafeMode = useMutation({
    mutationFn: dvSafeApi.enableSafeMode,
    onSuccess: () => {
      refreshSettings();
      toast.success('Safe Mode is on');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not turn Safe Mode on'),
  });

  // ---- quick exit address
  const [exitDraft, setExitDraft] = useState<string | null>(null);

  // ---- contacts
  const [contact, setContact] = useState({ name: '', phone: '', email: '', relationship: '', notifyOnPanic: true });
  const addContact = useMutation({
    mutationFn: () =>
      dvSafeApi.addContact({
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim() || undefined,
        relationship: contact.relationship.trim(),
        notifyOnPanic: contact.notifyOnPanic,
      }),
    onSuccess: () => {
      refreshSettings();
      setContact({ name: '', phone: '', email: '', relationship: '', notifyOnPanic: true });
      toast.success('Contact added');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not add that contact'),
  });
  const removeContact = useMutation({
    mutationFn: (id: string) => dvSafeApi.removeContact(id),
    onSuccess: refreshSettings,
    onError: (error) => toast.error(errorMessage(error) || 'Could not remove that contact'),
  });

  // ---- alert
  const [alertResult, setAlertResult] = useState<{ notifiedContacts: string[]; unreachableContacts: string[]; timestamp: string } | null>(null);
  const panic = useMutation({
    mutationFn: dvSafeApi.panic,
    onSuccess: (response) => setAlertResult(response.data),
    onError: (error) => toast.error(errorMessage(error) || 'The alert could not be sent. Call 000 if you are in danger.'),
  });

  // ---- safe chats
  const [newChat, setNewChat] = useState({ name: '', disguisedName: '', accessPin: '' });
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinDraft, setPinDraft] = useState('');
  const [openChat, setOpenChat] = useState<{ chat: ChatView; pin?: string } | null>(null);
  const [message, setMessage] = useState('');
  const [autoDelete, setAutoDelete] = useState(0);

  const refreshChats = () => queryClient.invalidateQueries({ queryKey: ['dv-safe-chats'] });

  const createChat = useMutation({
    mutationFn: () =>
      dvSafeApi.createChat({
        name: newChat.name.trim(),
        disguisedName: newChat.disguisedName.trim() || undefined,
        accessPin: newChat.accessPin.trim() || undefined,
      }),
    onSuccess: () => {
      refreshChats();
      setNewChat({ name: '', disguisedName: '', accessPin: '' });
      toast.success('Safe chat created');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not create the chat'),
  });
  const open = useMutation({
    mutationFn: ({ chatId, pin }: { chatId: string; pin?: string }) => dvSafeApi.openChat(chatId, pin),
    onSuccess: (response, { pin }) => {
      setOpenChat({ chat: response.data as ChatView, pin });
      setPinFor(null);
      setPinDraft('');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not open that chat'),
  });
  const send = useMutation({
    mutationFn: () =>
      dvSafeApi.sendChatMessage(openChat!.chat.id, {
        content: message.trim(),
        ...(autoDelete ? { autoDeleteMinutes: autoDelete } : {}),
        ...(openChat!.pin ? { pin: openChat!.pin } : {}),
      }),
    onSuccess: (response) => {
      setMessage('');
      setOpenChat((current) => (current ? { ...current, chat: { ...current.chat, messages: [...current.chat.messages, response.data as ChatMessage] } } : current));
      refreshChats();
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not send that'),
  });
  const deleteChat = useMutation({
    mutationFn: () => dvSafeApi.deleteChat(openChat!.chat.id, openChat!.pin),
    onSuccess: () => {
      setOpenChat(null);
      refreshChats();
      toast.success('Chat deleted');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not delete the chat'),
  });

  // ---- traces
  const clearTraces = useMutation({
    mutationFn: dvSafeApi.clearTraces,
    onSuccess: () => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.history.replaceState(null, '', '/dashboard/safety');
      } catch {
        // Storage can be blocked; the server side is already done.
      }
      toast.success('Traces cleared on this device');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not clear traces'),
  });

  const s = settings.data;
  const contacts = s?.emergencyContacts ?? [];
  const canAlert = Boolean(s?.panicButtonEnabled) && contacts.some((c) => c.notifyOnPanic);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-6 w-6 text-rose-600" /> Safety
          </h1>
          <p className="mt-1 max-w-xl text-slate-500 dark:text-slate-400">
            Tools for staying safe while you use ATHENA. Everything here is yours alone; nobody else can see it.
          </p>
        </div>
        <button
          type="button"
          onClick={exit}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        >
          <DoorOpen className="h-5 w-5" /> Quick exit
        </button>
      </div>

      {settings.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : settings.isError || !s ? (
        <div className="card p-6 text-sm text-slate-500">Could not load your safety settings.</div>
      ) : (
        <>
          {/* Safe Mode */}
          <section className="card space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                  <ShieldAlert className="h-5 w-5" /> Safe Mode
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  One switch: hides you from search, closes your messages, keeps notifications vague, and turns on quick exit and the safety alert.
                </p>
              </div>
              {s.isSafeMode ? (
                <button type="button" onClick={() => update.mutate({ isSafeMode: false })} disabled={update.isPending} className="btn-outline px-4 py-2 text-sm">
                  Turn Safe Mode off
                </button>
              ) : (
                <button type="button" onClick={() => enableSafeMode.mutate()} disabled={enableSafeMode.isPending} className="btn-primary px-4 py-2 text-sm">
                  Turn Safe Mode on
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <Toggle on={s.hideFromSearch} onChange={(v) => update.mutate({ hideFromSearch: v })} label="Hide me from search" description="Your profile does not come up when people search." disabled={update.isPending} />
              <Toggle on={!s.allowMessages} onChange={(v) => update.mutate({ allowMessages: !v })} label="Close my messages" description="Nobody new can start a conversation with you." disabled={update.isPending} />
              <Toggle on={s.notificationsSafe} onChange={(v) => update.mutate({ notificationsSafe: v })} label="Keep notifications vague" description='Your phone shows "New update" instead of who wrote and what.' disabled={update.isPending} />
              <Toggle on={s.panicButtonEnabled} onChange={(v) => update.mutate({ panicButtonEnabled: v })} label="Safety alert button" description="Lets you tell your emergency contacts with one tap." disabled={update.isPending} />
              <Toggle on={s.safeExitEnabled} onChange={(v) => update.mutate({ safeExitEnabled: v })} label="Quick exit with the Escape key" description="Pressing Escape on this page leaves for the address below." disabled={update.isPending} />
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (exitDraft === null) return;
                update.mutate({ safeExitUrl: exitDraft.trim() }, { onSuccess: () => setExitDraft(null) });
              }}
              className="flex flex-wrap items-center gap-2 pt-2"
            >
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">Quick exit goes to</span>
                <input
                  type="url"
                  value={exitDraft ?? s.safeExitUrl}
                  onChange={(event) => setExitDraft(event.target.value)}
                  placeholder={DEFAULT_EXIT}
                  className="input w-full"
                />
              </label>
              <button type="submit" disabled={exitDraft === null || update.isPending} className="btn-outline mt-6 px-3 py-2 text-sm">
                Save
              </button>
            </form>
          </section>

          {/* Emergency contacts and alert */}
          <section className="card space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Phone className="h-5 w-5" /> Emergency contacts
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                People to tell when you press the alert. Contacts are reached by email; keep their phone numbers here so you can call them yourself.
              </p>
            </div>

            {contacts.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-900 dark:text-white">
                        {c.name} <span className="font-normal text-slate-500">· {c.relationship}</span>
                      </span>
                      <span className="block text-xs text-slate-500">
                        <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="hover:underline">
                          {c.phone}
                        </a>
                        {c.email ? ` · ${c.email}` : ' · no email: cannot be emailed by the alert'}
                        {!c.notifyOnPanic && ' · not told on alert'}
                      </span>
                    </span>
                    <button type="button" onClick={() => removeContact.mutate(c.id)} disabled={removeContact.isPending} aria-label={`Remove ${c.name}`} className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!contact.name.trim() || !contact.phone.trim() || !contact.relationship.trim()) return;
                addContact.mutate();
              }}
              className="grid gap-2 sm:grid-cols-2"
            >
              <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Name" aria-label="Contact name" maxLength={100} required className="input" />
              <input value={contact.relationship} onChange={(e) => setContact({ ...contact, relationship: e.target.value })} placeholder="Relationship, e.g. sister" aria-label="Relationship" maxLength={50} required className="input" />
              <input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="Phone" aria-label="Phone" maxLength={20} required className="input" type="tel" />
              <input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email (so the alert can reach them)" aria-label="Email" maxLength={254} className="input" type="email" />
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 sm:col-span-2">
                <input type="checkbox" checked={contact.notifyOnPanic} onChange={(e) => setContact({ ...contact, notifyOnPanic: e.target.checked })} className="rounded" />
                Tell this person when I press the alert
              </label>
              <button type="submit" disabled={addContact.isPending} className="btn-outline inline-flex items-center justify-center gap-1 px-3 py-2 text-sm sm:col-span-2">
                <UserPlus className="h-4 w-4" /> Add contact
              </button>
            </form>

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-900/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-rose-900 dark:text-rose-100">Safety alert</p>
                  <p className="text-sm text-rose-800 dark:text-rose-200">
                    {canAlert
                      ? 'Emails your emergency contacts now and asks them to reach you.'
                      : !s.panicButtonEnabled
                        ? 'Turn on the safety alert button above to use this.'
                        : 'Add a contact with an email address and ask to have them told.'}{' '}
                    In immediate danger, call <a href="tel:000" className="font-semibold underline">000</a>.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canAlert || panic.isPending}
                  onClick={() => {
                    if (window.confirm('Send the safety alert to your emergency contacts now?')) panic.mutate();
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {panic.isPending ? 'Sending…' : 'Send alert'}
                </button>
              </div>
              {alertResult && (
                <p className="mt-3 text-sm text-rose-900 dark:text-rose-100" role="status">
                  {alertResult.notifiedContacts.length > 0 ? `Emailed ${alertResult.notifiedContacts.join(', ')}.` : 'Nobody could be emailed.'}{' '}
                  {alertResult.unreachableContacts.length > 0 && `Could not reach ${alertResult.unreachableContacts.join(', ')} (no email on file): call them.`}
                </p>
              )}
            </div>
          </section>

          {/* Safe chats */}
          <section className="card space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Lock className="h-5 w-5" /> Safe chats
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Private notes only you can open. They are encrypted, listed under a harmless name, and can be locked with a PIN. Messages can delete themselves.
              </p>
            </div>

            {openChat ? (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{openChat.chat.name}</p>
                    <p className="text-xs text-slate-500">Shown as “{openChat.chat.disguisedName}”</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this chat and everything in it?')) deleteChat.mutate();
                      }}
                      disabled={deleteChat.isPending}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Delete chat
                    </button>
                    <button type="button" onClick={() => setOpenChat(null)} className="btn-outline px-3 py-1 text-xs">
                      Close
                    </button>
                  </div>
                </div>
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {openChat.chat.messages.length === 0 ? (
                    <li className="text-sm text-slate-500">Nothing written yet.</li>
                  ) : (
                    openChat.chat.messages.map((m) => (
                      <li key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {format(new Date(m.createdAt), 'd MMM, h:mm a')}
                          {m.autoDeleteAt && ` · deletes ${format(new Date(m.autoDeleteAt), 'd MMM, h:mm a')}`}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!message.trim() || send.isPending) return;
                    send.mutate();
                  }}
                  className="space-y-2"
                >
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={5000} placeholder="Write here…" aria-label="Message" className="input w-full" />
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={autoDelete} onChange={(e) => setAutoDelete(Number(e.target.value))} aria-label="Auto-delete" className="input py-1.5 text-sm">
                      {AUTO_DELETE.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" disabled={!message.trim() || send.isPending} className="btn-primary px-4 py-1.5 text-sm">
                      Save
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {(chats.data?.length ?? 0) > 0 && (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {chats.data!.map((chat) => (
                      <li key={chat.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-white">
                            {chat.hasPin && <KeyRound className="h-3.5 w-3.5 text-slate-400" aria-label="PIN protected" />}
                            {chat.disguisedName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {chat.messageCount} {chat.messageCount === 1 ? 'entry' : 'entries'} · last {format(new Date(chat.lastActivity), 'd MMM')}
                          </span>
                        </span>
                        {pinFor === chat.id ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              open.mutate({ chatId: chat.id, pin: pinDraft });
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              value={pinDraft}
                              onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              inputMode="numeric"
                              autoFocus
                              placeholder="PIN"
                              aria-label="PIN"
                              className="input w-24 py-1 text-sm"
                            />
                            <button type="submit" disabled={pinDraft.length < 4 || open.isPending} className="btn-primary px-3 py-1 text-xs">
                              Open
                            </button>
                            <button type="button" onClick={() => setPinFor(null)} className="text-xs text-slate-500">
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => (chat.hasPin ? (setPinFor(chat.id), setPinDraft('')) : open.mutate({ chatId: chat.id }))}
                            disabled={open.isPending}
                            className="btn-outline px-3 py-1 text-xs"
                          >
                            Open
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!newChat.name.trim()) return;
                    createChat.mutate();
                  }}
                  className="grid gap-2 sm:grid-cols-3"
                >
                  <input value={newChat.name} onChange={(e) => setNewChat({ ...newChat, name: e.target.value })} placeholder="Name for you, e.g. Plan" aria-label="Chat name" maxLength={100} required className="input" />
                  <input value={newChat.disguisedName} onChange={(e) => setNewChat({ ...newChat, disguisedName: e.target.value })} placeholder="Shown as, e.g. Shopping List" aria-label="Disguised name" maxLength={60} className="input" />
                  <input
                    value={newChat.accessPin}
                    onChange={(e) => setNewChat({ ...newChat, accessPin: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    inputMode="numeric"
                    placeholder="PIN, 4 to 10 digits (optional)"
                    aria-label="PIN"
                    className="input"
                  />
                  <button type="submit" disabled={createChat.isPending || (newChat.accessPin.length > 0 && newChat.accessPin.length < 4)} className="btn-outline px-3 py-2 text-sm sm:col-span-3">
                    New safe chat
                  </button>
                </form>
              </>
            )}
          </section>

          {/* Traces */}
          <section className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Eraser className="h-5 w-5" /> Clear traces on this device
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Removes saved drafts and settings from this browser and takes this page out of its history.</p>
            </div>
            <button type="button" onClick={() => clearTraces.mutate()} disabled={clearTraces.isPending} className="btn-outline px-4 py-2 text-sm">
              Clear now
            </button>
          </section>

          {/* Support */}
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Someone to talk to</h2>
              <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Country" className="input py-1.5 text-sm">
                {REGIONS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {(resources.data ?? []).map((r) => (
                <li key={r.name} className="rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
                  <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
                  <p className="text-slate-600 dark:text-slate-300">{r.description}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-3">
                    <a href={`tel:${r.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:underline dark:text-rose-300">
                      <Phone className="h-3.5 w-3.5" /> {r.phone}
                    </a>
                    <a href={r.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" /> Website
                    </a>
                    <span className="text-xs text-slate-400">{r.available}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
