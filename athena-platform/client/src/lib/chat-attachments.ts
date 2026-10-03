'use client';

/**
 * Files sent in a conversation.
 *
 * A picture, a voice note or a clip sent in a direct message or a group chat
 * lives under the conversation's own private folder, `chat/<conversation>/…`,
 * and the message carries the file's key, never a link. Nothing about it can
 * be opened without asking the API, which checks the reader is in that
 * conversation now and mints a link that lives five minutes (server
 * utils/chat-attachments). This is the client side of that: one place that
 * asks, keeps the answer for a little under its lifetime so a thread of twenty
 * pictures is not twenty requests on every render, and asks again when a link
 * has run out or a player reports it stopped working.
 *
 * On a developer's machine the file is on the API's own disk, served by
 * GET /api/media/local/<key>, which needs the session header a browser never
 * sends with an <img>. It is fetched through the API instead and held as an
 * object URL, which does not expire.
 *
 * A file sent before chat files were private carries a plain link on the
 * message; it is shown as it always was, and nothing here is asked about it.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, mediaApi } from './api';

/** `chat/<conversation or group>/<sender>_<uuid>.<ext>`: the shape the server writes and nothing else. */
const CHAT_KEY =
  /^chat\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9]{1,8}$/;

export function isChatAttachmentKey(key: unknown): key is string {
  return typeof key === 'string' && CHAT_KEY.test(key);
}

/** What the server says a link lives, when it does not say. */
const DEFAULT_LINK_SECONDS = 300;
/** A link is reused for this much less than its lifetime, so one handed to a player is never about to expire. */
const LINK_MARGIN_MS = 60_000;
/** The least a minted link is reused for, however short the server says it lives. */
const LINK_MIN_REUSE_MS = 30_000;

type HeldLink = { url: string; freshUntil: number };

const held = new Map<string, HeldLink>();
const inFlight = new Map<string, Promise<string>>();

/** For tests. */
export function resetChatAttachmentLinks(): void {
  held.clear();
  inFlight.clear();
}

async function mint(key: string): Promise<string> {
  const minted = await mediaApi.downloadUrl(key);
  const data = (minted.data?.data ?? {}) as { downloadUrl?: string; expiresIn?: number };
  if (!data.downloadUrl) throw new Error('No link came back for that file');

  if (data.downloadUrl.includes('/api/media/local/')) {
    // The server's own path, taken through the same proxy as every other call
    // so the session header travels with it (lib/private-files does the same
    // for a résumé).
    const localPath = new URL(data.downloadUrl, window.location.origin).pathname.replace(/^\/api/, '');
    const file = await api.get(localPath, { responseType: 'blob' });
    const url = URL.createObjectURL(file.data as Blob);
    held.set(key, { url, freshUntil: Number.POSITIVE_INFINITY });
    return url;
  }

  const seconds = typeof data.expiresIn === 'number' && data.expiresIn > 0 ? data.expiresIn : DEFAULT_LINK_SECONDS;
  held.set(key, {
    url: data.downloadUrl,
    freshUntil: Date.now() + Math.max(seconds * 1000 - LINK_MARGIN_MS, LINK_MIN_REUSE_MS),
  });
  return data.downloadUrl;
}

/**
 * A link that opens the file under this key for the signed-in member, from
 * what was minted a moment ago when that is still fresh, and from the API
 * otherwise. `fresh` asks again whatever is held, for a player that has just
 * found its link no longer works. Rejects when the API refuses: the member is
 * not in that conversation any more, or the file is gone.
 */
export function resolveChatAttachmentUrl(key: string, options: { fresh?: boolean } = {}): Promise<string> {
  if (!options.fresh) {
    const link = held.get(key);
    if (link && link.freshUntil > Date.now()) return Promise.resolve(link.url);
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const work = mint(key).finally(() => {
    if (inFlight.get(key) === work) inFlight.delete(key);
  });
  inFlight.set(key, work);
  return work;
}

export type ChatAttachmentLink =
  | { status: 'loading'; url: null }
  | { status: 'ready'; url: string }
  | { status: 'unavailable'; url: null };

/**
 * The link for a chat file, for a component that shows it. `refresh` asks for
 * a new one, for a player whose link has run out while the thread stayed open;
 * it is answered at most twice, so a file that is really gone is reported as
 * unavailable rather than asked for forever.
 */
export function useChatAttachmentUrl(key: string | undefined): ChatAttachmentLink & { refresh: () => void } {
  const [link, setLink] = useState<ChatAttachmentLink>({ status: 'loading', url: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) {
      setLink({ status: 'unavailable', url: null });
      return undefined;
    }
    let cancelled = false;
    // A link already on screen stays while a fresh one is asked for, so a
    // picture does not blink out while its player is being renewed.
    setLink((current) => (current.status === 'ready' ? current : { status: 'loading', url: null }));
    resolveChatAttachmentUrl(key, { fresh: attempt > 0 }).then(
      (url) => {
        if (!cancelled) setLink({ status: 'ready', url });
      },
      () => {
        if (!cancelled) setLink({ status: 'unavailable', url: null });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const refresh = useCallback(() => setAttempt((count) => (count < 2 ? count + 1 : count)), []);

  return { ...link, refresh };
}
