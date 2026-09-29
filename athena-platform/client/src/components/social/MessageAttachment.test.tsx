import { render, screen } from '@testing-library/react';
import { MessageAttachment, attachmentKind, toMessageAttachments } from './MessageAttachment';

describe('attachmentKind', () => {
  it('reads the declared type first', () => {
    expect(attachmentKind('image/webp', 'https://cdn/x.bin')).toBe('image');
    expect(attachmentKind('video/mp4')).toBe('video');
    expect(attachmentKind('audio/webm')).toBe('audio');
    expect(attachmentKind('application/pdf', 'https://cdn/x.jpg')).toBe('file');
  });

  it('falls back to the extension for a row stored without a type', () => {
    expect(attachmentKind(undefined, 'https://cdn/posts/u1/a.JPG?v=2')).toBe('image');
    expect(attachmentKind(null, 'https://cdn/videos/u1/a.mov')).toBe('video');
    expect(attachmentKind('', 'https://cdn/sounds/u1/a.m4a')).toBe('audio');
    expect(attachmentKind(undefined, 'https://cdn/documents/u1/a')).toBe('file');
  });
});

describe('toMessageAttachments', () => {
  it('keeps what can be shown and drops what cannot', () => {
    const rows = toMessageAttachments([
      { url: 'https://cdn/posts/u1/a.jpg', key: 'posts/u1/a.jpg', contentType: 'image/jpeg', name: 'a.jpg' },
      { key: 'documents/u1/private.pdf' },
      null,
      'not an attachment',
    ]);
    expect(rows).toEqual([{ id: 'posts/u1/a.jpg', type: 'image', url: 'https://cdn/posts/u1/a.jpg', name: 'a.jpg' }]);
  });

  it('is empty for a message that has no attachments', () => {
    expect(toMessageAttachments(undefined)).toEqual([]);
    expect(toMessageAttachments({})).toEqual([]);
  });
});

describe('MessageAttachment', () => {
  it('shows a picture inline', () => {
    render(<MessageAttachment attachment={{ type: 'image', url: 'https://cdn/a.jpg', name: 'Beach' }} />);
    expect(screen.getByRole('img', { name: 'Beach' })).toHaveAttribute('src', 'https://cdn/a.jpg');
  });

  it('never links to a script URL', () => {
    render(<MessageAttachment attachment={{ type: 'file', url: 'javascript:alert(1)', name: 'notes' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('notes')).toBeInTheDocument();
  });

  it('links a file it can open safely', () => {
    render(<MessageAttachment attachment={{ type: 'file', url: 'https://cdn/a.pdf', name: 'Plan' }} />);
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('href', 'https://cdn/a.pdf');
  });
});
