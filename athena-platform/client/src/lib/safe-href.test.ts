import { safeHref } from './safe-href';

describe('safeHref', () => {
  it('keeps web links and relative paths', () => {
    expect(safeHref('https://example.com/x')).toBe('https://example.com/x');
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('/dashboard/cars')).toBe('/dashboard/cars');
    expect(safeHref(' https://example.com ')).toBe('https://example.com');
  });

  it('drops anything a browser would execute or that is not a link', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('JavaScript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeHref('vbscript:msgbox')).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});
