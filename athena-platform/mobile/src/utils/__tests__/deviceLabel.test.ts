import { describe, it, expect } from '@jest/globals';
import { describeDevice } from '../deviceLabel';

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
      'Safari on an iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Safari on iPhone',
    ],
    [
      'Chrome on Android, not Linux',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
      'Chrome on Android',
    ],
    ['the Android app', 'okhttp/4.12.0', 'Mobile app on Android'],
    ['the iOS app', 'Athena/1 CFNetwork/1494.0.7 Darwin/23.4.0', 'Mobile app on iOS'],
  ])('reads %s', (_label, userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected);
  });

  it('is "Unknown device" for anything it does not recognise, never the raw string', () => {
    for (const value of [undefined, null, '', '   ', 'curl/8.4.0', 'node-fetch', 'x'.repeat(500)]) {
      expect(describeDevice(value)).toBe('Unknown device');
    }
  });
});
