import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/lib/api', () => ({
  api: {},
  creatorApi: { getGifts: jest.fn(), getBalance: jest.fn(), sendGift: jest.fn() },
}));

// The card step is exercised on its own; here only that it opens matters.
jest.mock('@/components/creator/TopUpModal', () => ({
  TopUpModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="top-up-modal">Top up your gift points</div> : null,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { SendGiftSheet } from './SendGiftSheet';
import { creatorApi } from '@/lib/api';

const mockedApi = creatorApi as unknown as { getGifts: jest.Mock; getBalance: jest.Mock; sendGift: jest.Mock };

const gifts = [
  { id: 'spark', name: 'Spark', value: 1, icon: '✨', description: 'Show some love!' },
  { id: 'star', name: 'Star', value: 5, icon: '⭐', description: 'You shine bright!' },
];

function renderSheet(balance: number, onClose = jest.fn()) {
  mockedApi.getGifts.mockResolvedValue({ data: { success: true, data: gifts } });
  mockedApi.getBalance.mockResolvedValue({ data: { success: true, data: { balance, valueAud: balance * 0.01 } } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SendGiftSheet isOpen onClose={onClose} receiverId="creator-1" receiverName="Ada" />
    </QueryClientProvider>
  );
  return { onClose };
}

const giftButton = (name: string) => screen.getByText(name).closest('button') as HTMLButtonElement;

describe('SendGiftSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.sendGift.mockResolvedValue({ data: { success: true, data: { transaction: {}, creatorShare: 4 } } });
  });

  it('shows the top-up path when the balance is short, and never posts', async () => {
    renderSheet(3);

    expect(await screen.findByText('You have 3 points')).toBeInTheDocument();
    fireEvent.click(giftButton('Star'));

    expect(screen.getByText(/needs 2 more points/)).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Send Star' });
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(mockedApi.sendGift).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Top up' }));
    expect(screen.getByTestId('top-up-modal')).toBeInTheDocument();
    expect(mockedApi.sendGift).not.toHaveBeenCalled();
  });

  it('sends the chosen gift with the note when the balance covers it', async () => {
    const { onClose } = renderSheet(50);

    expect(await screen.findByText('You have 50 points')).toBeInTheDocument();
    fireEvent.click(giftButton('Star'));
    fireEvent.change(screen.getByLabelText('Add a note (optional)'), { target: { value: 'Loved your reel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Star' }));

    await waitFor(() =>
      expect(mockedApi.sendGift).toHaveBeenCalledWith({ receiverId: 'creator-1', giftType: 'star', message: 'Loved your reel' })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('leaves the note out of the body when it is empty', async () => {
    renderSheet(50);

    expect(await screen.findByText('You have 50 points')).toBeInTheDocument();
    fireEvent.click(giftButton('Spark'));
    fireEvent.click(screen.getByRole('button', { name: 'Send Spark' }));

    await waitFor(() => expect(mockedApi.sendGift).toHaveBeenCalledWith({ receiverId: 'creator-1', giftType: 'spark' }));
  });

  it('does nothing until a gift is chosen', async () => {
    renderSheet(50);

    expect(await screen.findByText('You have 50 points')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('says so and stays open when the server refuses', async () => {
    mockedApi.sendGift.mockRejectedValueOnce({ response: { data: { message: 'Receiver is not a monetized creator' } } });
    const { onClose } = renderSheet(50);

    expect(await screen.findByText('You have 50 points')).toBeInTheDocument();
    fireEvent.click(giftButton('Star'));
    fireEvent.click(screen.getByRole('button', { name: 'Send Star' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Receiver is not a monetized creator');
    expect(onClose).not.toHaveBeenCalled();
  });
});
