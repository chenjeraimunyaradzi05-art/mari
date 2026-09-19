import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupMembers } from '../GroupMembers';

jest.mock('@/lib/api', () => ({
  groupsApi: {
    listMembers: jest.fn(),
    listBannedMembers: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    muteMember: jest.fn(),
    unmuteMember: jest.fn(),
    banMember: jest.fn(),
    unbanMember: jest.fn(),
    addMember: jest.fn(),
  },
  mentionApi: { suggest: jest.fn() },
}));

jest.mock('@/lib/hooks', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

import { groupsApi, mentionApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';

const api = groupsApi as unknown as Record<string, jest.Mock>;
const mentions = mentionApi as unknown as { suggest: jest.Mock };
const mockedAuth = useAuthStore as unknown as jest.Mock;

const members = [
  { userId: 'admin-1', role: 'ADMIN', displayName: 'Priya', avatar: null, joinedAt: '2026-01-01T00:00:00.000Z', isMuted: false },
  { userId: 'member-2', role: 'MEMBER', displayName: 'Mei', avatar: null, joinedAt: '2026-01-02T00:00:00.000Z', isMuted: false },
];

function renderMembers(viewerRole: 'admin' | 'moderator' | 'member', canInvite = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupMembers groupId="g1" viewerRole={viewerRole} canInvite={canInvite} />
    </QueryClientProvider>
  );
}

describe('GroupMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockReturnValue({ user: { id: 'viewer' } });
    api.listMembers.mockResolvedValue({ data: { data: members } });
    api.listBannedMembers.mockResolvedValue({ data: { data: [] } });
  });

  it('gives an admin the role select and Ban for the others', async () => {
    renderMembers('admin');
    await screen.findByText('Mei');

    expect(screen.getByLabelText('Role for Mei')).toBeInTheDocument();
    expect(screen.getByLabelText('Role for Priya')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Ban' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  });

  it('lets a moderator mute and remove a member, but never an admin, and never ban', async () => {
    renderMembers('moderator');
    await screen.findByText('Mei');

    expect(screen.getByRole('button', { name: 'Mute 24h' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Ban' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Role for/)).not.toBeInTheDocument();
    // The banned list is an admin's; a moderator is not even asked for it.
    expect(api.listBannedMembers).not.toHaveBeenCalled();
  });

  it('shows a plain member the list and nothing to press', async () => {
    renderMembers('member');
    await screen.findByText('Priya');

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByLabelText('Add someone')).not.toBeInTheDocument();
  });

  it('shows an admin who is banned and lets her lift the ban', async () => {
    api.listBannedMembers.mockResolvedValue({
      data: { data: [{ userId: 'b1', displayName: 'Zara', avatar: null, bannedReason: 'Kept spamming' }] },
    });
    api.unbanMember.mockResolvedValue({ data: { success: true } });
    window.confirm = jest.fn(() => true);

    renderMembers('admin');
    expect(await screen.findByText('Banned (1)')).toBeInTheDocument();
    expect(screen.getByText('Kept spamming')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unban' }));
    await waitFor(() => expect(api.unbanMember).toHaveBeenCalledWith('g1', 'b1'));
  });

  it('adds someone by name, leaving out people already in the group', async () => {
    jest.useFakeTimers();
    mentions.suggest.mockResolvedValue({
      data: { data: [{ id: 'member-2', name: 'Mei', avatar: null, headline: null }, { id: 'u9', name: 'Zara Okoro', avatar: null, headline: 'Founder' }] },
    });
    api.addMember.mockResolvedValue({ data: { data: { status: 'added' } } });

    renderMembers('admin');
    await screen.findByText('Mei');

    fireEvent.change(screen.getByLabelText('Add someone'), { target: { value: 'Za' } });
    jest.advanceTimersByTime(200);
    jest.useRealTimers();

    expect(await screen.findByRole('option', { name: /Zara Okoro/ })).toBeInTheDocument();
    // Mei is already a member, so she is not offered.
    expect(screen.queryByRole('option', { name: /^Mei$/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Zara Okoro/ }));
    await waitFor(() => expect(api.addMember).toHaveBeenCalledWith('g1', 'u9'));
  });
});
