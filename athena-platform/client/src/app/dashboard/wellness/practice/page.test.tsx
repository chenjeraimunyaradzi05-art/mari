import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

/**
 * A verified practitioner's own page says when her registration was checked
 * and when the next yearly check falls, and warns her while it is due, so a
 * listing that comes down for its check is never a surprise.
 */

jest.mock('@/lib/wellness-api', () => ({
  wellnessApi: { practice: jest.fn(), practiceBookings: jest.fn(async () => ({ data: { data: [] } })), savePractice: jest.fn(), updatePracticeBooking: jest.fn() },
  wellnessError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard/wellness/practice', useRouter: () => ({ push: jest.fn() }) }));

import { wellnessApi } from '@/lib/wellness-api';
import PracticePage from './page';

const practice = wellnessApi.practice as jest.Mock;

const profile = (verification: unknown) => ({
  id: 'p1', slug: 'dr-p1', name: 'Dr Kate New', kind: 'PSYCHOLOGIST', headline: 'Perinatal psychologist', bio: 'Twenty years of perinatal work in Brisbane.',
  qualifications: [], modalities: [], specialties: [], languages: ['English'], suburb: null, city: 'Brisbane', state: 'QLD',
  telehealth: true, inPerson: false, bulkBilling: false, medicareRebate: true, privateHealth: false, feeFrom: null, feeNote: null,
  ahpraNumber: 'PSY0001234567', website: null, phone: null, bookingUrl: null, availability: null, slotMinutes: 50, acceptsBookings: true,
  isVerified: true, verification,
});
const answer = (verification: unknown) => ({ data: { data: { profile: profile(verification), counts: {}, kinds: [{ key: 'PSYCHOLOGIST', label: 'Psychologist' }], modalities: [], specialties: [] } } });

describe('Practice page verification note', () => {
  it('says when the next yearly check is due while it is current', async () => {
    practice.mockResolvedValue(answer({ checkedAt: '2026-03-01T00:00:00Z', dueAt: '2027-03-01T00:00:00Z', lapsesAt: '2027-03-31T00:00:00Z', status: 'CURRENT' }));
    render(<PracticePage />);
    expect(await screen.findByText(/Registration is checked again every year; your next check is due by/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('warns her while the check is due, with the day the listing comes out', async () => {
    practice.mockResolvedValue(answer({ checkedAt: '2025-09-01T00:00:00Z', dueAt: '2026-09-01T00:00:00Z', lapsesAt: '2026-10-01T00:00:00Z', status: 'DUE' }));
    render(<PracticePage />);
    expect(await screen.findByRole('status')).toHaveTextContent('Your yearly registration check is due. Your profile stays in the directory until');
  });
});
