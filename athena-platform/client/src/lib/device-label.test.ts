import { describeDevice } from './device-label';

describe('describeDevice', () => {
  it.each([
    [
      'Chrome on Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Chrome on Windows',
    ],
    [
      'Edge, which also says Chrome',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
      'Edge on Windows',
    ],
    [
      'Safari on a Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Safari on Mac',
    ],
    [
      'Safari on an iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Safari on iPhone',
    ],
    [
      'Chrome on an iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
      'Chrome on iPhone',
    ],
    [
      'Safari on an iPad',
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Safari on iPad',
    ],
    [
      'Chrome on Android, not Linux',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
      'Chrome on Android',
    ],
    [
      'Samsung Internet',
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      'Samsung Internet on Android',
    ],
    [
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
      'Firefox on Linux',
    ],
    [
      'Chrome on a Chromebook',
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Chrome on ChromeOS',
    ],
    ['the Android app', 'okhttp/4.12.0', 'Mobile app on Android'],
    ['the iOS app', 'Athena/1 CFNetwork/1494.0.7 Darwin/23.4.0', 'Mobile app on iOS'],
  ])('reads %s', (_label, userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected);
  });

  it('says only what it can read: a system with no recognised browser, and a browser with no recognised system', () => {
    expect(describeDevice('curl/8.4.0 (Windows)')).toBe('Windows');
    expect(describeDevice('Something Safari/1.0')).toBe('Safari');
  });

  it('is "Unknown device" for anything it does not recognise, never the raw string', () => {
    for (const value of [undefined, null, '', '   ', 'curl/8.4.0', 'node-fetch', 'x'.repeat(500)]) {
      expect(describeDevice(value)).toBe('Unknown device');
    }
  });
});
