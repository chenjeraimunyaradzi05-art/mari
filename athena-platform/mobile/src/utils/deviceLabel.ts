/**
 * A device, in the words a member would use for it, from the user-agent string
 * the server kept when she signed in. The web security page reads the same
 * strings the same way (client/src/lib/device-label.ts); the two are kept
 * alike by hand, because the phone app does not share source with the web.
 *
 * It reads two things, the browser and the system, and says nothing about what
 * it cannot read: no version, no model, no place. A string it does not
 * recognise is "Unknown device", never a guess and never the raw text.
 *
 * Order matters in both lists: browsers built on Chrome say "Chrome" too, and an
 * iPad in desktop mode says "Macintosh".
 */

const BROWSERS: Array<[RegExp, string]> = [
  [/\b(Edg|EdgA|EdgiOS)\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(Firefox|FxiOS)\//, 'Firefox'],
  [/\b(Chrome|CriOS|Chromium)\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/\bWindows\b/, 'Windows'],
  [/\bAndroid\b/, 'Android'],
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\b(Macintosh|Mac OS X)\b/, 'Mac'],
  [/\bLinux\b|\bX11\b/, 'Linux'],
];

/** This app talks through the platform's own network stack, which names itself instead of a browser. */
function appDescription(userAgent: string): string | null {
  if (/^okhttp\//i.test(userAgent)) return 'Mobile app on Android';
  if (/\bCFNetwork\//.test(userAgent) && !/\bMozilla\//.test(userAgent)) return 'Mobile app on iOS';
  return null;
}

export function describeDevice(userAgent?: string | null): string {
  const ua = (userAgent ?? '').trim();
  if (!ua) return 'Unknown device';

  const app = appDescription(ua);
  if (app) return app;

  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1];

  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}
