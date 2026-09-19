'use client';

/**
 * The one interactive piece of the cookie policy page. The page itself is a
 * server component rendering cookies.md; this island forgets the cached
 * decision so the consent banner opens again on reload and the member can
 * choose afresh. The server record is replaced by the next choice, never
 * blanked.
 */

import { Settings } from 'lucide-react';
import { clearCookieConsentCache } from '@/lib/cookie-consent';

export default function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={() => {
        clearCookieConsentCache();
        window.location.reload();
      }}
      className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
    >
      <Settings className="h-4 w-4" aria-hidden="true" />
      Change my cookie choices
    </button>
  );
}
