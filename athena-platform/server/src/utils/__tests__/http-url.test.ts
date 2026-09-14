import { describe, it, expect } from '@jest/globals';
import { httpUrl, isHttpUrl } from '../http-url';

describe('links a member types in', () => {
  it('lets http and https through and nothing else', () => {
    expect(isHttpUrl('https://example.com/a?b=c')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isHttpUrl('vbscript:msgbox')).toBe(false);
    expect(isHttpUrl('ftp://example.com/file')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });

  it('is the zod schema the routes use, with the length cap', () => {
    expect(httpUrl(300).safeParse('  https://example.com/page ').success).toBe(true);
    expect(httpUrl(300).safeParse('javascript:alert(1)').success).toBe(false);
    expect(httpUrl(300).safeParse('JAVASCRIPT:alert(1)').success).toBe(false);
    expect(httpUrl(20).safeParse('https://example.com/a-very-long-path').success).toBe(false);
    const issue = httpUrl().safeParse('data:text/plain,hello');
    expect(issue.success).toBe(false);
    if (!issue.success) expect(issue.error.issues[0].message).toContain('http');
  });
});
