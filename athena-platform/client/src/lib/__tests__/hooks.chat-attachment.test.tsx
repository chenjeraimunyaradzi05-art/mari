import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * A file picked in a thread goes up for that thread. It used to be uploaded as
 * a post picture, a reel or a sound, into a public folder with no audience, and
 * the message carried the public link. The server now stores a chat file under
 * the conversation's own private folder and refuses a link on a message, so the
 * hook has to say which conversation the file is for, send a clip as one, and
 * hand back the key and nothing that could be opened without asking.
 */

const mockUploadChatFile = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn() };

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => mockToast.success(...args),
    error: (...args: unknown[]) => mockToast.error(...args),
  },
}));
jest.mock('../socket', () => ({ socketClient: {} }));
jest.mock('../store', () => ({
  useAuthStore: jest.fn(),
  useUIStore: jest.fn(),
  useNotificationStore: jest.fn(),
  useMessageStore: jest.fn(),
}));
jest.mock('../api', () => ({
  api: {},
  mediaApi: {
    upload: jest.fn(),
    uploadChatFile: (...args: unknown[]) => mockUploadChatFile(...args),
  },
}));

import { mediaApi } from '../api';
import { useUploadChatAttachment } from '../hooks';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const uploaded = (key: string, contentType: string, size: number) => ({
  data: { success: true, data: { key, url: `https://bucket.s3.ap-southeast-2.amazonaws.com/${key}`, contentType, size } },
});

beforeEach(() => jest.clearAllMocks());

describe('useUploadChatAttachment', () => {
  it('uploads a picture for the conversation it was picked in and hands back its key, never a link', async () => {
    const key = 'chat/conv-1/me_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.webp';
    mockUploadChatFile.mockResolvedValue(uploaded(key, 'image/webp', 1234));
    const file = new File(['RIFF'], 'kitchen.webp', { type: 'image/webp' });
    const { result } = renderHook(() => useUploadChatAttachment({ conversationId: 'conv-1' }), { wrapper });

    let attachment: unknown;
    await act(async () => {
      attachment = await result.current.mutateAsync(file);
    });

    expect(mockUploadChatFile).toHaveBeenCalledWith(file, { conversationId: 'conv-1' });
    expect(attachment).toEqual({ key, name: 'kitchen.webp', contentType: 'image/webp', size: 1234 });
    expect(attachment).not.toHaveProperty('url');
    // Not as a post picture, a reel or a sound any more.
    expect(mediaApi.upload).not.toHaveBeenCalled();
  });

  it('uploads for a group room when that is where it was picked', async () => {
    const key = 'chat/group-1/me_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.m4a';
    mockUploadChatFile.mockResolvedValue(uploaded(key, 'audio/mp4', 9000));
    const file = new File(['....'], 'note.m4a', { type: 'audio/mp4' });
    const { result } = renderHook(() => useUploadChatAttachment({ groupId: 'group-1' }), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(file);
    });

    expect(mockUploadChatFile).toHaveBeenCalledWith(file, { groupId: 'group-1' });
  });

  it('says what went wrong, in the server’s words, when the upload is refused', async () => {
    mockUploadChatFile.mockRejectedValue({ response: { data: { message: 'Wait for them to accept your message request before sending more' } } });
    const file = new File(['RIFF'], 'kitchen.webp', { type: 'image/webp' });
    const { result } = renderHook(() => useUploadChatAttachment({ conversationId: 'conv-1' }), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(file).catch(() => undefined);
    });

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith('Wait for them to accept your message request before sending more')
    );
  });
});
