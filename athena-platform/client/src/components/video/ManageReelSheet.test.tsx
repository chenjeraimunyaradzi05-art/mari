import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/lib/api-extensions', () => ({
  videoApi: { update: jest.fn(), delete: jest.fn() },
}));

// apiMessage reads the error shape only; the module it lives in imports the
// axios instance, which the sheet never touches directly.
jest.mock('@/lib/api', () => ({ api: {} }));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { ManageReelSheet, parseReelTags } from './ManageReelSheet';
import { videoApi } from '@/lib/api-extensions';

const mockedApi = videoApi as unknown as { update: jest.Mock; delete: jest.Mock };

const reel = {
  id: 'reel-1',
  title: 'Negotiating the offer',
  description: 'What I wish I had known.',
  hashtags: ['salary', 'interviews'],
  status: 'PUBLISHED',
  thumbnailUrl: null,
};

describe('ManageReelSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.update.mockResolvedValue({ data: { data: {} } });
    mockedApi.delete.mockResolvedValue({ data: { success: true } });
  });

  it('hides a reel by sending status HIDDEN, then offers to show it again', async () => {
    const onUpdated = jest.fn();
    render(<ManageReelSheet reel={reel} onClose={jest.fn()} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole('button', { name: /Hide from feed/ }));

    await waitFor(() => expect(mockedApi.update).toHaveBeenCalledWith('reel-1', { status: 'HIDDEN' }));
    expect(await screen.findByRole('button', { name: /Show again/ })).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'reel-1', status: 'HIDDEN' }));
  });

  it('shows a hidden reel again with status PUBLISHED', async () => {
    render(<ManageReelSheet reel={{ ...reel, status: 'HIDDEN' }} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Show again/ }));

    await waitFor(() => expect(mockedApi.update).toHaveBeenCalledWith('reel-1', { status: 'PUBLISHED' }));
  });

  it('asks before deleting, and only deletes once she confirms', async () => {
    const onDeleted = jest.fn();
    const onClose = jest.fn();
    render(<ManageReelSheet reel={reel} onClose={onClose} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));

    expect(mockedApi.delete).not.toHaveBeenCalled();
    expect(screen.getByText(/Delete it for good\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(mockedApi.delete).not.toHaveBeenCalled();
    expect(screen.queryByText(/Delete it for good\?/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('reel-1'));
    expect(onDeleted).toHaveBeenCalledWith('reel-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('saves only the fields that changed', async () => {
    render(<ManageReelSheet reel={reel} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'What I wish I had known, and what I did.' } });
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: '#interviews salary, leadership' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockedApi.update).toHaveBeenCalledWith('reel-1', {
        description: 'What I wish I had known, and what I did.',
        hashtags: ['interviews', 'salary', 'leadership'],
      })
    );
  });

  it('closes without a request when nothing changed', () => {
    const onClose = jest.fn();
    render(<ManageReelSheet reel={reel} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedApi.update).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not offer hide or show while the reel is still processing', () => {
    render(<ManageReelSheet reel={{ ...reel, status: 'PROCESSING' }} onClose={jest.fn()} />);

    expect(screen.queryByRole('button', { name: /Hide from feed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show again/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Still being made web-ready/)).toBeInTheDocument();
  });

  it('keeps the sheet open and says so when the server refuses', async () => {
    mockedApi.update.mockRejectedValueOnce({ response: { data: { message: 'Not authorized' } } });
    const onClose = jest.fn();
    render(<ManageReelSheet reel={reel} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Hide from feed/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Not authorized');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Hide from feed/ })).toBeInTheDocument();
  });
});

describe('parseReelTags', () => {
  it('strips hashes, lowercases, de-duplicates and drops one-letter tags', () => {
    expect(parseReelTags('#Salary, salary interviews a #Leadership')).toEqual(['salary', 'interviews', 'leadership']);
  });
});
