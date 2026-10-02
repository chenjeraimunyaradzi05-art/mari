import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * A thread in the mental health forums. A reply can be reported (it could not
 * be: only a post had a button), "someone may be at risk of harming themselves"
 * is a reason, and a reply that sounds like crisis shows its author the lines
 * and says a moderator has been told.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/wellness-api', () => ({
  wellnessApi: { post: jest.fn(), reply: jest.fn(), support: jest.fn(), reportPost: jest.fn(), reportReply: jest.fn(), updatePost: jest.fn(), deletePost: jest.fn(), updateReply: jest.fn(), deleteReply: jest.fn() },
  wellnessError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('next/navigation', () => ({ useParams: () => ({ slug: 'anxiety', postId: 'p1' }), useRouter: () => ({ push: jest.fn() }), usePathname: () => '/dashboard/wellness/forums/anxiety/p1' }));

import toast from 'react-hot-toast';
import { wellnessApi } from '@/lib/wellness-api';
import ThreadPage from './page';

const api = wellnessApi as unknown as { post: jest.Mock; reply: jest.Mock; reportPost: jest.Mock; reportReply: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const LINES = [
  { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
  { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Crisis support' },
  { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', url: 'https://www.1800respect.org.au', when: '24/7', who: 'Domestic, family and sexual violence' },
];
const author = (over: Record<string, unknown> = {}) => ({ id: null, name: 'A member', avatar: null, isAnonymous: true, isYou: false, isModerator: false, ...over });

const thread = {
  post: { id: 'p1', title: 'What helps on a bad morning?', body: 'Looking for the small things.', contentWarning: null, isHidden: false, hiddenReason: null, isPinned: false, isLocked: false, supportCount: 0, createdAt: '2026-09-10T00:00:00Z', author: author(), supportedByMe: false, canEdit: false, forum: { slug: 'anxiety', name: 'Anxiety' } },
  replies: [{ id: 'r1', body: 'You should just stop talking about it', isHidden: false, isFromModerator: false, createdAt: '2026-09-10T01:00:00Z', author: author(), canEdit: false }],
  replyPage: 1, replyLimit: 50, replyTotal: 1, isModerator: false, crisisLines: LINES, viewer: { hiddenWarnings: [], anonymousByDefault: false },
};

describe('A forum thread: reporting, and crisis support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.post.mockResolvedValue({ data: { data: thread } });
  });

  it('puts "someone may be at risk of harming themselves" first among the reasons, and says what to do if it cannot wait', async () => {
    render(<ThreadPage />);
    fireEvent.click((await screen.findAllByRole('button', { name: /Report/ }))[0]);

    const reasons = screen.getByLabelText('What is wrong') as HTMLSelectElement;
    expect([...reasons.options].map((o) => o.value)[0]).toBe('SELF_HARM');
    expect(screen.queryByText(/call 000/)).not.toBeInTheDocument();

    fireEvent.change(reasons, { target: { value: 'SELF_HARM' } });
    expect(screen.getByText(/call 000, or Lifeline on 13 11 14/)).toBeInTheDocument();
  });

  it('reports a reply, which had no button, and gives her the reference and the clock', async () => {
    api.reportReply.mockResolvedValue({ data: { data: { id: 'rep1', status: 'PENDING', reference: 'RPT-ABC-1234', reviewHours: 24 } } });
    render(<ThreadPage />);

    // The post's own Report is first; the reply's is the second.
    const buttons = await screen.findAllByRole('button', { name: /Report/ });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    fireEvent.change(screen.getByLabelText('What is wrong'), { target: { value: 'SELF_HARM' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(api.reportReply).toHaveBeenCalledWith('r1', { reason: 'SELF_HARM', description: undefined }));
    expect(api.reportPost).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('RPT-ABC-1234'));
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('within 24 hours'));
  });

  it('still reports the post through the post route', async () => {
    api.reportPost.mockResolvedValue({ data: { data: { id: 'rep2', reference: 'RPT-ZZZ-9', reviewHours: 48 } } });
    render(<ThreadPage />);

    fireEvent.click((await screen.findAllByRole('button', { name: /Report/ }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(api.reportPost).toHaveBeenCalledWith('p1', { reason: 'INAPPROPRIATE', description: undefined }));
    expect(api.reportReply).not.toHaveBeenCalled();
  });

  it('shows the author of a reply that sounds like crisis the lines, and that a moderator has been told', async () => {
    api.reply.mockResolvedValue({
      data: {
        data: {
          reply: { id: 'r2' },
          crisis: { flagged: true, message: 'It sounds like things are very hard right now. Your reply is up. These lines are staffed this minute. Because others can read it, a moderator has been told too.', lines: LINES },
        },
      },
    });
    render(<ThreadPage />);

    fireEvent.change(await screen.findByPlaceholderText(/What helped you/), { target: { value: 'Some nights I cannot go on.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('a moderator has been told too');
    expect(notice).toHaveTextContent('1800RESPECT');
  });
});
