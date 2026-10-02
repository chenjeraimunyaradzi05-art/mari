import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The mental load page. It used to say "Act now" at a burnout level of high and
 * nothing more, and it said nothing at all to a woman who logged a task that
 * sounded like crisis. The page is hers alone, so what she is shown is the lines;
 * nobody else is told, and the notice says so.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/wellness-api', () => ({
  wellnessApi: { mentalLoad: jest.fn(), addLoad: jest.fn(), deleteLoad: jest.fn() },
  wellnessError: (_err: unknown, fallback: string) => fallback,
  localDay: () => '2026-09-11',
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard/wellness/mental-load', useRouter: () => ({ push: jest.fn() }) }));

import { wellnessApi } from '@/lib/wellness-api';
import MentalLoadPage from './page';

const api = wellnessApi as unknown as { mentalLoad: jest.Mock; addLoad: jest.Mock };

const LINES = [
  { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
  { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Crisis support' },
  { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', url: 'https://www.1800respect.org.au', when: '24/7', who: 'Domestic, family and sexual violence' },
];

const load = (level: 'fine' | 'watch' | 'high') => ({
  data: {
    data: {
      today: '2026-09-11',
      entries: [],
      categories: [{ key: 'PLANNING', label: 'Planning', invisible: true, examples: 'School forms' }],
      crisisLines: LINES,
      analysis: {
        window: { from: '2026-08-17', to: '2026-09-11', weeks: 4 },
        totalHours: 0, myHours: 0, myShare: 0, invisibleShare: 0, byCategory: [], byCarrier: [], weekly: [], impactScore: 0, impactLabel: 'Light',
        burnout: { level, title: 'Burnout signs', reasons: [], advice: 'Take it slowly.' },
        delegation: [], conversationCard: '', notes: [],
      },
    },
  },
});

describe('The mental load page and crisis support', () => {
  beforeEach(() => jest.clearAllMocks());

  it('puts the crisis lines on the page when the burnout level is high, with 1800RESPECT among them', async () => {
    api.mentalLoad.mockResolvedValue(load('high'));
    render(<MentalLoadPage />);

    const strip = await screen.findByRole('note', { name: 'Crisis support lines' });
    expect(strip).toHaveTextContent('Lifeline');
    expect(strip).toHaveTextContent('13 11 14');
    expect(strip).toHaveTextContent('1800RESPECT');
    expect(strip).toHaveTextContent('000');
    // A call is one tap away.
    expect(strip.querySelector('a[href="tel:1800737732"]')).not.toBeNull();
  });

  it.each(['fine', 'watch'] as const)('does not show the lines at a burnout level of %s', async (level) => {
    api.mentalLoad.mockResolvedValue(load(level));
    render(<MentalLoadPage />);
    await screen.findByText('Log it');
    expect(screen.queryByRole('note', { name: 'Crisis support lines' })).not.toBeInTheDocument();
  });

  it('shows the lines, and says nobody has been told, when a task she logged sounds like crisis', async () => {
    api.mentalLoad.mockResolvedValue(load('fine'));
    api.addLoad.mockResolvedValue({
      data: {
        data: {
          id: 'ml1',
          crisis: { flagged: true, message: 'It sounds like things are very hard right now. What you wrote is saved and is shown to nobody but you; nobody has been told. These lines are staffed this minute.', lines: LINES },
        },
      },
    });
    render(<MentalLoadPage />);

    fireEvent.change(await screen.findByPlaceholderText(/School forms, dinner plan/), { target: { value: 'Planning the funeral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(api.addLoad).toHaveBeenCalled());
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('shown to nobody but you; nobody has been told');
    expect(notice).toHaveTextContent('1800RESPECT');
    // She can put it away, and what she wrote stays logged.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows nothing extra for a task that is calm', async () => {
    api.mentalLoad.mockResolvedValue(load('fine'));
    api.addLoad.mockResolvedValue({ data: { data: { id: 'ml2', crisis: { flagged: false } } } });
    render(<MentalLoadPage />);

    fireEvent.change(await screen.findByPlaceholderText(/School forms, dinner plan/), { target: { value: 'School forms' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(api.addLoad).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
