'use client';

/**
 * Speaks error toasts.
 *
 * react-hot-toast gives every toast role="status" and aria-live="polite",
 * errors included, and only merges `style` from the per-type defaults on
 * <Toaster>, so setting ariaProps there does nothing. Polite means a screen
 * reader finishes whatever it is saying first, and a toast that lasts a few
 * seconds can expire before it is ever reached. Someone is then left waiting on
 * a save that failed, with nothing on screen to go back to.
 *
 * Rather than change 357 call sites, this mirrors error toasts into one
 * assertive live region. The region holds no visible content, so nothing is
 * shown twice; only the announcement is duplicated, and only for errors.
 */

import { useEffect, useRef, useState } from 'react';
import { useToasterStore, resolveValue } from 'react-hot-toast';

export function ToastAnnouncer() {
  const { toasts } = useToasterStore();
  const [announcement, setAnnouncement] = useState('');
  const spoken = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unspokenError = toasts.find(
      (t) => t.type === 'error' && t.visible && !spoken.current.has(t.id)
    );

    if (!unspokenError) return;

    spoken.current.add(unspokenError.id);

    // resolveValue unwraps the render-prop form a toast message can take.
    const message = resolveValue(unspokenError.message, unspokenError);

    if (typeof message === 'string' && message.trim()) {
      setAnnouncement(message.trim());
    }
  }, [toasts]);

  // Forget ids once their toast is gone, so the set cannot grow without bound
  // over a long session.
  useEffect(() => {
    const live = new Set(toasts.map((t) => t.id));
    for (const id of spoken.current) {
      if (!live.has(id)) spoken.current.delete(id);
    }
  }, [toasts]);

  return (
    <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
