import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { ReportContext } from './ReportContext';

/**
 * What a moderator reads when she opens a report on something said.
 *
 * It used to be a bare identifier. The copy the report kept is shown with the
 * lines before it, the reported line marked, and a plain statement that it is a
 * copy (so a message that has since been deleted is not mistaken for a missing
 * one).
 */

const line = (id: string, senderName: string, content: string, minute: number) => ({
  id,
  senderId: id,
  senderName,
  content,
  attachments: [] as Array<{ name?: string; type?: string; url?: string }>,
  createdAt: `2026-10-01T03:0${minute}:00.000Z`,
});

describe('a reported message', () => {
  const messageContext = {
    version: 1,
    surface: 'direct' as const,
    conversationId: 'c1',
    groupId: null,
    groupName: null,
    capturedAt: '2026-10-01T03:10:00.000Z',
    reported: { ...line('m3', 'Dan', 'I know where you work', 3), edited: true },
    before: [line('m1', 'Ana', 'Hello again', 1), line('m2', 'Dan', 'Why are you ignoring me', 2)],
  };

  it('shows the words, the lines before them in order, and marks the reported one', () => {
    render(<ReportContext context={{ messageContext }} />);

    const items = within(screen.getByRole('region', { name: 'The reported message' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Hello again'),
      expect.stringContaining('Why are you ignoring me'),
      expect.stringContaining('I know where you work'),
    ]);
    expect(items[2]).toHaveTextContent('reported');
    expect(items[2]).toHaveTextContent('edited');
    expect(items[0]).not.toHaveTextContent('reported');
  });

  it('says it is a copy, so a deleted message is not read as a missing one', () => {
    render(<ReportContext context={{ messageContext }} />);

    expect(screen.getByText(/A copy taken when it was reported/)).toBeInTheDocument();
    expect(screen.getByText(/may have been unsent, deleted or\s+expired since; this stays/)).toBeInTheDocument();
    expect(screen.getByText('Direct message')).toBeInTheDocument();
  });

  it('names the group for a group chat, and says so when nothing came before the message', () => {
    render(
      <ReportContext
        context={{
          messageContext: { ...messageContext, surface: 'group', groupId: 'g1', groupName: 'Brisbane founders', before: [] },
        }}
      />
    );

    expect(screen.getByText('Group chat: Brisbane founders')).toBeInTheDocument();
    expect(screen.getByText('Nothing came before it in this conversation.')).toBeInTheDocument();
  });

  it('lists attachments by name, and links only the ones that have an address', () => {
    render(
      <ReportContext
        context={{
          messageContext: {
            ...messageContext,
            reported: {
              ...messageContext.reported,
              attachments: [
                { name: 'photo.jpg', type: 'image', url: '/uploads/photo.jpg' },
                { name: 'gone.pdf', type: 'file' },
              ],
            },
          },
        }}
      />
    );

    expect(screen.getByRole('link', { name: 'photo.jpg' })).toHaveAttribute('href', '/uploads/photo.jpg');
    expect(screen.getByText('gone.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'gone.pdf' })).not.toBeInTheDocument();
  });
});

describe('a reported live stream', () => {
  it('shows a chat line with the ones before it', () => {
    render(
      <ReportContext
        context={{
          liveContext: {
            capturedAt: '2026-10-01T03:10:00.000Z',
            streamId: 's1',
            streamTitle: 'Salary negotiation, live',
            hostId: 'host-1',
            hostName: 'Mei C.',
            reported: { id: 'l3', userId: 'troll', userName: 'Troll', content: 'show us your address', createdAt: '2026-10-01T03:03:00.000Z' },
            before: [{ id: 'l2', userId: 'fan', userName: 'Fan', content: 'lol', createdAt: '2026-10-01T03:02:00.000Z' }],
          },
        }}
      />
    );

    expect(screen.getByText(/Live stream: Salary negotiation, live · host Mei C\./)).toBeInTheDocument();
    const items = within(screen.getByRole('region', { name: 'The reported live stream' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent('show us your address');
    expect(items[1]).toHaveTextContent('reported');
  });

  it('describes the stream, and offers to watch it only while it is live', () => {
    const stream = (status: string) => ({
      liveContext: {
        capturedAt: '2026-10-01T03:10:00.000Z',
        streamId: 's1',
        streamTitle: 'Live',
        hostId: 'host-1',
        hostName: null,
        stream: { description: 'Come along', category: 'career', status, startedAt: null },
      },
    });

    const { rerender } = render(<ReportContext context={stream('LIVE')} />);
    expect(screen.getByText('Come along')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Watch it' })).toHaveAttribute('href', '/live/s1');

    rerender(<ReportContext context={stream('ENDED')} />);
    expect(screen.getByText('Status when reported: ended.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Watch it' })).not.toBeInTheDocument();
  });
});

describe('a reported group', () => {
  it('shows what it said it was when it was reported', () => {
    render(
      <ReportContext
        context={{
          groupContext: {
            capturedAt: '2026-10-01T03:10:00.000Z',
            groupId: 'g1',
            name: 'Quick money',
            description: 'DM me for a deal',
            privacy: 'PUBLIC',
            createdById: 'owner',
          },
        }}
      />
    );

    expect(screen.getByText('Group: Quick money')).toBeInTheDocument();
    expect(screen.getByText('DM me for a deal')).toBeInTheDocument();
    expect(screen.getByText(/public group, as it was described when reported/)).toBeInTheDocument();
  });
});

describe('a report that kept nothing', () => {
  it('shows nothing, rather than an empty box', () => {
    const { container, rerender } = render(<ReportContext context={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ReportContext context={undefined} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ReportContext context={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
