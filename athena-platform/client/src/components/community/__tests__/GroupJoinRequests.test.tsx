import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupJoinRequests } from '../GroupJoinRequests';

jest.mock('@/lib/api', () => ({
  groupsApi: {
    listJoinRequests: jest.fn(),
    approveJoinRequest: jest.fn(),
    denyJoinRequest: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { groupsApi } from '@/lib/api';

const api = groupsApi as unknown as Record<string, jest.Mock>;

const requests = [
  {
    id: 'r1',
    userId: 'u2',
    createdAt: new Date().toISOString(),
    user: { id: 'u2', firstName: 'Mei', lastName: 'Chen', displayName: null, avatar: null, headline: 'Product lead' },
  },
  {
    id: 'r2',
    userId: 'u3',
    createdAt: new Date().toISOString(),
    user: { id: 'u3', firstName: null, lastName: null, displayName: 'Zara', avatar: null, headline: null },
  },
];

function renderRequests() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupJoinRequests groupId="g1" />
    </QueryClientProvider>
  );
}

describe('GroupJoinRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.listJoinRequests.mockResolvedValue({ data: { data: requests } });
    api.approveJoinRequest.mockResolvedValue({ data: { success: true } });
    api.denyJoinRequest.mockResolvedValue({ data: { success: true } });
  });

  it('names each person asking', async () => {
    renderRequests();
    expect(await screen.findByText('Mei Chen')).toBeInTheDocument();
    expect(screen.getByText('Zara')).toBeInTheDocument();
    expect(screen.getByText(/Product lead/)).toBeInTheDocument();
  });

  it('approves and declines by the request id', async () => {
    renderRequests();
    await screen.findByText('Mei Chen');

    fireEvent.click(screen.getAllByRole('button', { name: /Approve/ })[0]);
    await waitFor(() => expect(api.approveJoinRequest).toHaveBeenCalledWith('g1', 'r1'));

    fireEvent.click(screen.getAllByRole('button', { name: /Decline/ })[1]);
    await waitFor(() => expect(api.denyJoinRequest).toHaveBeenCalledWith('g1', 'r2'));
  });

  it('says so when nobody is waiting', async () => {
    api.listJoinRequests.mockResolvedValue({ data: { data: [] } });
    renderRequests();
    expect(await screen.findByText('Nobody is waiting to join.')).toBeInTheDocument();
  });
});
