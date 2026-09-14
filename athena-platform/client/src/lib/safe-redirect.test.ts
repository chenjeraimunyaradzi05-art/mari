import { safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it('honours a path on this site', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard');
    expect(safeRedirect('/cars/mechanics/jos-garage?service=logbook')).toBe('/cars/mechanics/jos-garage?service=logbook');
  });

  it('refuses another host, however it is spelt', () => {
    expect(safeRedirect('//evil.example/x')).toBeNull();
    expect(safeRedirect('/\\evil.example')).toBeNull();
    expect(safeRedirect('https://evil.example')).toBeNull();
    expect(safeRedirect('evil.example')).toBeNull();
    expect(safeRedirect('/ok\nLocation: https://evil.example')).toBeNull();
    expect(safeRedirect('')).toBeNull();
    expect(safeRedirect(null)).toBeNull();
  });
});
