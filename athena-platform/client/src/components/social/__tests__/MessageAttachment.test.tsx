import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * How a file on a message is shown. A file sent since chat files became
 * private carries only its key, and a picture is drawn only once the API has
 * minted a link for the person looking; a file from before carries the public
 * link it always had and is shown as it was. A file the API refuses is said to
 * be unavailable, not drawn broken, and a link of a kind the browser must not
 * follow is never made into one.
 */

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
  mediaApi: { downloadUrl: jest.fn() },
}));

import { mediaApi } from '@/lib/api';
import { resetChatAttachmentLinks } from '@/lib/chat-attachments';
import { MessageAttachment, toMessageAttachments } from '../MessageAttachment';

const mint = mediaApi.downloadUrl as unknown as jest.Mock;
const KEY = 'chat/conv-1/sender-1_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.webp';
const CLIP_KEY = 'chat/conv-1/sender-1_1b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.mp4';

beforeEach(() => {
  jest.clearAllMocks();
  resetChatAttachmentLinks();
});

describe('toMessageAttachments', () => {
  it('keeps a file that has a chat key and no link, which is every file sent since', () => {
    const shown = toMessageAttachments([{ key: KEY, name: 'kitchen.webp', contentType: 'image/webp', size: 10 }]);

    expect(shown).toEqual([{ id: KEY, type: 'image', key: KEY, name: 'kitchen.webp' }]);
  });

  it('keeps a file from before, which has a link and no chat key', () => {
    const shown = toMessageAttachments([{ url: 'https://cdn.example/posts/u1/old.jpg', contentType: 'image/jpeg' }]);

    expect(shown).toEqual([{ id: 'https://cdn.example/posts/u1/old.jpg-0', type: 'image', url: 'https://cdn.example/posts/u1/old.jpg', name: undefined }]);
  });

  it('reads the kind off the key’s extension when the row declared no type', () => {
    expect(toMessageAttachments([{ key: CLIP_KEY }])[0].type).toBe('video');
  });

  it('drops a row with neither, and a key that is not one the server writes for a chat file', () => {
    expect(toMessageAttachments([{ name: 'nothing' }, { key: 'posts/u1/x.webp' }, 'text', null])).toEqual([]);
  });
});

describe('MessageAttachment for a file in the private chat folder', () => {
  it('shows the picture once a link has been minted for the person looking', async () => {
    mint.mockResolvedValue({ data: { data: { downloadUrl: 'https://s3.example/signed?one', expiresIn: 300 } } });

    render(<MessageAttachment attachment={{ type: 'image', key: KEY, name: 'kitchen.webp' }} />);

    expect(screen.queryByRole('img')).toBeNull();
    const picture = await screen.findByRole('img', { name: 'kitchen.webp' });
    expect(picture).toHaveAttribute('src', 'https://s3.example/signed?one');
    expect(mint).toHaveBeenCalledWith(KEY);
  });

  it('says a file the API refuses is no longer available, and draws nothing broken', async () => {
    mint.mockRejectedValue(Object.assign(new Error('Request failed'), { response: { status: 404 } }));

    render(<MessageAttachment attachment={{ type: 'image', key: KEY, name: 'kitchen.webp' }} />);

    await screen.findByText('kitchen.webp is no longer available');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('asks for a fresh link once when the player reports the old one stopped working, then gives up honestly', async () => {
    mint
      .mockResolvedValueOnce({ data: { data: { downloadUrl: 'https://s3.example/signed?one', expiresIn: 300 } } })
      .mockResolvedValueOnce({ data: { data: { downloadUrl: 'https://s3.example/signed?two', expiresIn: 300 } } });

    const { container } = render(<MessageAttachment attachment={{ type: 'video', key: CLIP_KEY, name: 'clip.mp4' }} />);

    const player = await waitFor(() => {
      const video = container.querySelector('video');
      if (!video) throw new Error('not yet');
      return video;
    });
    expect(player).toHaveAttribute('src', 'https://s3.example/signed?one');

    fireEvent.error(player);
    await waitFor(() => expect(container.querySelector('video')).toHaveAttribute('src', 'https://s3.example/signed?two'));

    fireEvent.error(container.querySelector('video')!);
    await screen.findByText('clip.mp4 is no longer available');
    expect(container.querySelector('video')).toBeNull();
    expect(mint).toHaveBeenCalledTimes(2);
  });
});

describe('MessageAttachment for a file from before chat files were private', () => {
  it('shows the public link it always had without asking the API', () => {
    render(<MessageAttachment attachment={{ type: 'image', url: 'https://cdn.example/posts/u1/old.jpg', name: 'old.jpg' }} />);

    expect(screen.getByRole('img', { name: 'old.jpg' })).toHaveAttribute('src', 'https://cdn.example/posts/u1/old.jpg');
    expect(mint).not.toHaveBeenCalled();
  });

  it('never makes a link of a script address, and never asks the API about a key that is not a chat key', () => {
    const { container } = render(
      <MessageAttachment attachment={{ type: 'file', key: 'a1', url: 'javascript:alert(1)', name: 'third' }} />
    );

    expect(screen.getByText('third')).toBeInTheDocument();
    expect(container.querySelector('a')).toBeNull();
    expect(mint).not.toHaveBeenCalled();
  });
});
