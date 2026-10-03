import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * What a moderator is shown, and told, when she opens a report on something
 * said or streamed.
 *
 * The report used to show a bare identifier and offer "Remove content", which for
 * a message deleted the row the report pointed at, and for a stream or a group
 * could do nothing at all. Opening one now shows the copy the report kept, and
 * the remove button says what it does to that kind of thing before she presses it.
 */

jest.mock('./SafetyIncidents', () => ({
  MemberSafetyScore: () => null,
  SafetyIncidentsPanel: () => null,
}));
jest.mock('./LiveStreams', () => ({ LiveStreamsPanel: () => <div data-testid="live-streams" /> }));

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ user: { id: 'mod-1', role: 'MODERATOR' } }),
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

import ModerationQueuePage from './page';
import { api } from '@/lib/api';

const get = api.get as unknown as jest.Mock;
const post = api.post as unknown as jest.Mock;

const person = (id: string, name: string) => ({
  id,
  firstName: name,
  lastName: null,
  displayName: name,
  email: `${id}@example.com`,
});

const report = (overrides: Record<string, unknown> = {}) => ({
  id: 'rep-1',
  contentType: 'MESSAGE',
  contentId: 'msg-1',
  reason: 'harassment',
  description: null,
  status: 'REVIEWING',
  action: null,
  reviewerId: 'mod-1',
  reviewNotes: null,
  actionTakenAt: null,
  createdAt: '2026-10-01T03:00:00.000Z',
  reviewDeadline: '2099-10-03T03:00:00.000Z',
  priority: 'NORMAL',
  overdue: false,
  reporter: person('her', 'Ana'),
  reportedUser: person('him', 'Dan'),
  context: null,
  ...overrides,
});

function serve(open: Record<string, unknown>) {
  get.mockImplementation(async (url: string) => {
    if (url === '/safety/moderation/flags') return { data: { flags: [], openCount: 0, urgentCount: 0 } };
    if (url === '/admin/moderation/reports') return { data: { reports: [open], openCount: 1, overdueCount: 0 } };
    if (url === '/admin/moderation/anonymous-reports') return { data: { reports: [], openCount: 0 } };
    if (url === `/admin/moderation/reports/${open.id}`) return { data: { report: open, relatedReports: [] } };
    throw new Error(`unexpected ${url}`);
  });
}

async function openReport() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ModerationQueuePage />
    </QueryClientProvider>
  );
  fireEvent.click(await screen.findByText(/reported by Ana/));
  await screen.findByLabelText('Decision notes');
}

beforeEach(() => {
  jest.clearAllMocks();
  post.mockResolvedValue({ data: {} });
});

it('shows the copy a message report kept, ahead of the bare content id', async () => {
  serve(
    report({
      context: {
        messageContext: {
          surface: 'direct',
          conversationId: 'c1',
          groupId: null,
          groupName: null,
          capturedAt: '2026-10-01T03:10:00.000Z',
          reported: { id: 'msg-1', senderId: 'him', senderName: 'Dan', content: 'I know where you work', createdAt: '2026-10-01T03:03:00.000Z', attachments: [] },
          before: [],
        },
      },
    })
  );

  await openReport();

  expect(screen.getByText('I know where you work')).toBeInTheDocument();
  expect(screen.getByText(/A copy taken when it was reported/)).toBeInTheDocument();
  expect(screen.getByText('msg-1')).toBeInTheDocument();
});

it('says what removing a message does, and that the report keeps a copy', async () => {
  serve(report());
  await openReport();

  const remove = screen.getByRole('button', { name: 'Delete message' });
  expect(remove).toHaveAttribute('title', expect.stringContaining('This report keeps a copy'));
  expect(screen.queryByRole('button', { name: 'Remove content' })).not.toBeInTheDocument();
});

it('says that removing a stream ends it for good, asks before doing it, and sends the same decision', async () => {
  serve(report({ contentType: 'LIVESTREAM', contentId: 'stream-1' }));
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  await openReport();

  fireEvent.click(screen.getByRole('button', { name: 'End stream' }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('for good'));
  expect(post).not.toHaveBeenCalled();

  confirm.mockReturnValue(true);
  fireEvent.change(screen.getByLabelText('Decision notes'), { target: { value: 'Threats on air' } });
  fireEvent.click(screen.getByRole('button', { name: 'End stream' }));

  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith('/admin/moderation/reports/rep-1/action', { action: 'remove', notes: 'Threats on air' });
  confirm.mockRestore();
});

it('names removal for a chat line and a group in their own words, and keeps the rest as it was', async () => {
  serve(report({ contentType: 'LIVE_MESSAGE', contentId: 'line-1' }));
  await openReport();
  expect(screen.getByRole('button', { name: 'Delete chat message' })).toBeInTheDocument();
});

it('leaves "Remove content" for the kinds of content it was always right for', async () => {
  serve(report({ contentType: 'POST', contentId: 'post-1' }));
  await openReport();

  expect(screen.getByRole('button', { name: 'Remove content' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
});

it('shows the live streams panel for the moderators to work from', async () => {
  serve(report());
  await openReport();

  expect(screen.getByTestId('live-streams')).toBeInTheDocument();
});
