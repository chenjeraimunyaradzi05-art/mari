import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * A support circle's weekly check-in is read by the others in the circle. What
 * she writes in it used to be saved with no screen at all; now, when it sounds
 * like crisis, the answer carries the lines and a sentence that says a moderator
 * has been told, and the page puts them where she is looking.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/wellness-api', () => ({
  wellnessApi: { circle: jest.fn(), circleCheckIn: jest.fn(), joinCircle: jest.fn(), leaveCircle: jest.fn(), continueCircle: jest.fn(), updateCircle: jest.fn(), circleIcs: jest.fn() },
  wellnessError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'c1' }), useRouter: () => ({ push: jest.fn() }), usePathname: () => '/dashboard/wellness/circles/c1' }));

import { wellnessApi } from '@/lib/wellness-api';
import CirclePage from './page';

const api = wellnessApi as unknown as { circle: jest.Mock; circleCheckIn: jest.Mock };

const LINES = [
  { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
  { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Crisis support' },
  { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', url: 'https://www.1800respect.org.au', when: '24/7', who: 'Domestic, family and sexual violence' },
];

const circle = {
  id: 'c1', name: 'Burnout, eight weeks', topic: 'burnout', description: 'Weekly check-ins for women coming back from the edge.', capacity: 6, weeks: 8,
  startsOn: '2026-09-07', endsOn: '2026-11-01', meetingDay: 2, meetingTime: '19:00', format: 'VIDEO', meetingLink: null, location: null, status: 'RUNNING',
  facilitator: { id: 'f1', name: 'Mei', avatar: null, isAnonymous: false, isYou: false, isModerator: false }, memberCount: 3, spotsLeft: 3, isMember: true, isFacilitator: false, currentWeek: 1,
  strategies: [], schedule: [{ week: 1, day: '2026-09-09', time: '19:00' }], members: [], checkIns: [], myCheckIns: [],
};

async function fillAndCheckIn() {
  render(<CirclePage />);
  // The scale is a radio group of 1 to 5.
  const mood = await screen.findByRole('radiogroup', { name: 'How you are' });
  fireEvent.click(mood.querySelectorAll('button')[0]);
  const [wins, blockers, next] = screen.getAllByRole('textbox');
  fireEvent.change(wins, { target: { value: 'None' } });
  fireEvent.change(blockers, { target: { value: 'Everything' } });
  fireEvent.change(next, { target: { value: 'Nothing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
  await waitFor(() => expect(api.circleCheckIn).toHaveBeenCalled());
}

describe('A circle check-in and crisis support', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.circle.mockResolvedValue({ data: { data: circle } });
  });

  it('shows the lines, and says who has been told, when the check-in sounds like crisis', async () => {
    api.circleCheckIn.mockResolvedValue({
      data: {
        data: {
          id: 'ci1',
          crisis: { flagged: true, message: 'It sounds like things are very hard right now. Your check-in is saved. These lines are staffed this minute. Because others can read it, a moderator has been told too.', lines: LINES },
        },
      },
    });

    await fillAndCheckIn();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('a moderator has been told too');
    expect(notice).toHaveTextContent('Lifeline');
    expect(notice).toHaveTextContent('1800RESPECT');
    expect(notice.querySelector('a[href="tel:131114"]')).not.toBeNull();
    // What she wrote was sent as she wrote it.
    expect(api.circleCheckIn).toHaveBeenCalledWith('c1', { mood: 1, wins: 'None', blockers: 'Everything', nextStep: 'Nothing' });
  });

  it('shows nothing extra when the check-in is calm', async () => {
    api.circleCheckIn.mockResolvedValue({ data: { data: { id: 'ci2', crisis: { flagged: false } } } });
    await fillAndCheckIn();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
