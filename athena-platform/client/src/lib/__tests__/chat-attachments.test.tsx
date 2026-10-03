import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * A file sent in a conversation carries no link, only the key it is stored
 * under in the conversation's own private folder. The API mints a link for
 * whoever may open it, and the link lives five minutes. These pin that the
 * client asks for one, keeps it for a little under its lifetime rather than
 * asking on every render, asks again once it has run out, and reports a file
 * the API refuses as unavailable rather than drawing a broken picture.
 */

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
  mediaApi: { downloadUrl: jest.fn() },
}));

import { api, mediaApi } from '@/lib/api';
import {
  isChatAttachmentKey,
  resetChatAttachmentLinks,
  resolveChatAttachmentUrl,
  useChatAttachmentUrl,
} from '@/lib/chat-attachments';

const mint = mediaApi.downloadUrl as unknown as jest.Mock;
const get = api.get as unknown as jest.Mock;

const KEY = 'chat/conv-1/sender-1_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.webp';
const OTHER_KEY = 'chat/conv-1/sender-1_1b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.m4a';

const minted = (downloadUrl: string, expiresIn = 300) => ({ data: { data: { downloadUrl, expiresIn } } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  resetChatAttachmentLinks();
});

describe('isChatAttachmentKey', () => {
  it('knows the one shape the server writes for a chat file', () => {
    expect(isChatAttachmentKey(KEY)).toBe(true);
    expect(isChatAttachmentKey(OTHER_KEY)).toBe(true);
  });

  it('is not fooled by a post key, a link, a key with no uuid, or nothing', () => {
    expect(isChatAttachmentKey('posts/u1/7f3a.webp')).toBe(false);
    expect(isChatAttachmentKey('https://cdn.example/chat/conv-1/x.webp')).toBe(false);
    expect(isChatAttachmentKey('chat/conv-1/sender-1_not-a-uuid.webp')).toBe(false);
    expect(isChatAttachmentKey('a1')).toBe(false);
    expect(isChatAttachmentKey(undefined)).toBe(false);
  });
});

describe('resolveChatAttachmentUrl', () => {
  it('asks the API for a link and hands back what it minted', async () => {
    mint.mockResolvedValue(minted('https://s3.example/signed?one'));

    await expect(resolveChatAttachmentUrl(KEY)).resolves.toBe('https://s3.example/signed?one');
    expect(mint).toHaveBeenCalledWith(KEY);
  });

  it('asks once for a file shown several times while the link is fresh', async () => {
    mint.mockResolvedValue(minted('https://s3.example/signed?one'));

    const [first, second] = await Promise.all([resolveChatAttachmentUrl(KEY), resolveChatAttachmentUrl(KEY)]);
    const third = await resolveChatAttachmentUrl(KEY);

    expect([first, second, third]).toEqual(Array(3).fill('https://s3.example/signed?one'));
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('asks again once the link is about to run out', async () => {
    jest.useFakeTimers();
    mint.mockResolvedValueOnce(minted('https://s3.example/signed?one')).mockResolvedValueOnce(minted('https://s3.example/signed?two'));

    await expect(resolveChatAttachmentUrl(KEY)).resolves.toBe('https://s3.example/signed?one');

    // Three minutes in, still fresh; a minute before it expires, not any more.
    jest.setSystemTime(Date.now() + 3 * 60 * 1000);
    await expect(resolveChatAttachmentUrl(KEY)).resolves.toBe('https://s3.example/signed?one');
    jest.setSystemTime(Date.now() + 90 * 1000);
    await expect(resolveChatAttachmentUrl(KEY)).resolves.toBe('https://s3.example/signed?two');
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it('asks again at once when told the link stopped working', async () => {
    mint.mockResolvedValueOnce(minted('https://s3.example/signed?one')).mockResolvedValueOnce(minted('https://s3.example/signed?two'));

    await resolveChatAttachmentUrl(KEY);
    await expect(resolveChatAttachmentUrl(KEY, { fresh: true })).resolves.toBe('https://s3.example/signed?two');
  });

  it('keeps one file’s link apart from another’s', async () => {
    mint.mockImplementation(async (key: string) => minted(`https://s3.example/signed?${key.endsWith('.webp') ? 'picture' : 'sound'}`));

    await expect(resolveChatAttachmentUrl(KEY)).resolves.toMatch(/picture$/);
    await expect(resolveChatAttachmentUrl(OTHER_KEY)).resolves.toMatch(/sound$/);
  });

  it('fetches a file on the API’s own disk through the API, with the session, and keeps it as an object URL', async () => {
    mint.mockResolvedValue(minted(`http://localhost:5000/api/media/local/${KEY}`));
    const blob = new Blob(['RIFF'], { type: 'image/webp' });
    get.mockResolvedValue({ data: blob });
    const createObjectURL = jest.fn(() => 'blob:local-picture');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });

    await expect(resolveChatAttachmentUrl(KEY)).resolves.toBe('blob:local-picture');

    expect(get).toHaveBeenCalledWith(`/media/local/${KEY}`, { responseType: 'blob' });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('rejects when the API refuses, so the file is reported as unavailable and no link is kept', async () => {
    mint.mockRejectedValueOnce(Object.assign(new Error('Request failed'), { response: { status: 404 } }));
    mint.mockResolvedValueOnce(minted('https://s3.example/signed?later'));

    await expect(resolveChatAttachmentUrl(KEY)).rejects.toMatchObject({ response: { status: 404 } });
    // A refusal is not remembered: the next look asks again.
    await expect(resolveChatAttachmentUrl(KEY)).resolves.toBe('https://s3.example/signed?later');
  });
});

describe('useChatAttachmentUrl', () => {
  it('starts loading and settles on the minted link', async () => {
    mint.mockResolvedValue(minted('https://s3.example/signed?one'));

    const { result } = renderHook(() => useChatAttachmentUrl(KEY));

    expect(result.current).toMatchObject({ status: 'loading', url: null });
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', url: 'https://s3.example/signed?one' }));
  });

  it('reports a file the API refuses as unavailable', async () => {
    mint.mockRejectedValue(Object.assign(new Error('Request failed'), { response: { status: 404 } }));

    const { result } = renderHook(() => useChatAttachmentUrl(KEY));

    await waitFor(() => expect(result.current).toMatchObject({ status: 'unavailable', url: null }));
  });

  it('asks for a fresh link on refresh, keeps the old one on screen meanwhile, and stops after two', async () => {
    mint
      .mockResolvedValueOnce(minted('https://s3.example/signed?one'))
      .mockResolvedValueOnce(minted('https://s3.example/signed?two'))
      .mockResolvedValueOnce(minted('https://s3.example/signed?three'))
      .mockResolvedValue(minted('https://s3.example/signed?never'));

    const { result } = renderHook(() => useChatAttachmentUrl(KEY));
    await waitFor(() => expect(result.current.url).toBe('https://s3.example/signed?one'));

    act(() => result.current.refresh());
    // Never a blank bubble while the new link is on its way.
    expect(result.current).toMatchObject({ status: 'ready', url: 'https://s3.example/signed?one' });
    await waitFor(() => expect(result.current.url).toBe('https://s3.example/signed?two'));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.url).toBe('https://s3.example/signed?three'));

    act(() => result.current.refresh());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.url).toBe('https://s3.example/signed?three');
    expect(mint).toHaveBeenCalledTimes(3);
  });

  it('has nothing to show for a message with no key', () => {
    const { result } = renderHook(() => useChatAttachmentUrl(undefined));

    expect(result.current).toMatchObject({ status: 'unavailable', url: null });
    expect(mint).not.toHaveBeenCalled();
  });
});
