/**
 * A device, in the words a member would use for it, from the user-agent string
 * the server kept when she signed in.
 *
 * The security page used to print the raw string ("Mozilla/5.0 (Windows NT
 * 10.0; Win64; x64) AppleWebKit/537.36 ..."), which tells her nothing she can
 * recognise: she is looking for "that old laptop" or "my phone", and she is
 * deciding which session to end. This reads two things out of the string, the
 * browser and the system, and says nothing about anything it cannot read: no
 * version, no model, no place. A string it does not recognise is "Unknown
 * device", never a guess and never the raw text.
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

/** The phone app talks through the platform's own network stack, which names itself instead of a browser. */
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
