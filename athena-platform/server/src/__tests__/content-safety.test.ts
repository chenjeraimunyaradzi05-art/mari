import {
  CONTENT_LIMITS,
  normalizeMediaUrls,
  normalizeMessageAttachments,
  normalizeSafeUrl,
  normalizeUserText,
} from '../utils/contentSafety';

describe('content safety helpers', () => {
  it('trims text, removes unsafe control characters, and enforces limits', () => {
    expect(normalizeUserText('  hello\u0000 world  ', {
      field: 'content',
      maxLength: CONTENT_LIMITS.comment,
    })).toBe('hello world');

    expect(() =>
      normalizeUserText('x'.repeat(CONTENT_LIMITS.comment + 1), {
        field: 'content',
        maxLength: CONTENT_LIMITS.comment,
      })
    ).toThrow(/2000 characters or fewer/);
  });

  it('rejects unsafe URL schemes and embedded credentials', () => {
    expect(() => normalizeSafeUrl('javascript:alert(1)', { field: 'url' })).toThrow(/http or https/);
    expect(() => normalizeSafeUrl('https://user:pass@example.com/file.png', { field: 'url' })).toThrow(/credentials/);
  });

  it('accepts public upload media URLs and blocks non-array media payloads', () => {
    expect(normalizeMediaUrls(['/uploads/posts/user-1/image.webp'])).toEqual(['/uploads/posts/user-1/image.webp']);
    expect(() => normalizeMediaUrls('https://example.com/image.png')).toThrow(/must be an array/);
  });

  it('normalizes message attachments to a safe allow-listed shape', () => {
    expect(normalizeMessageAttachments([
      {
        url: '/api/media/local/documents/user-1/file.pdf',
        name: '  Offer letter  ',
        contentType: 'APPLICATION/PDF',
        size: 1200,
        unexpected: 'dropped',
      },
    ])).toEqual([
      {
        url: '/api/media/local/documents/user-1/file.pdf',
        name: 'Offer letter',
        contentType: 'application/pdf',
        size: 1200,
      },
    ]);

    expect(() => normalizeMessageAttachments([{ url: '/etc/passwd' }])).toThrow(/valid URL/);
  });
});
