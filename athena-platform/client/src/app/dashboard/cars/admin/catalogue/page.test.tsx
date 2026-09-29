import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The catalogue page is where a price or an ANCAP result is corrected now
 * that it is no longer a literal in the server's code. What these guard is
 * the as-at: members read it next to the figures, so a changed figure always
 * goes with a fresh one, a change of wording never pretends to be a check,
 * and "checked, still right" records the look without touching a figure.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), patch: (...a: unknown[]) => mockPatch(...a) }, mediaApi: {} }));
jest.mock('@/lib/stripe', () => ({ stripeConfigured: false }));
jest.mock('@/components/payments/PaymentIntentForm', () => ({ PaymentIntentForm: () => null }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));

import CatalogueAdminPage from './page';

const CAR = {
  id: 'car-1', slug: 'toyota-corolla-hybrid', make: 'Toyota', model: 'Corolla', variant: 'Ascent Sport Hybrid', year: 2025, bodyType: 'HATCH', bodyLabel: 'Hatch', fuelType: 'HYBRID', fuelLabel: 'Hybrid', transmission: 'AUTOMATIC', seats: 5, priceFrom: 32000,
  ancapStars: 5, ancapYear: 2018, ancap: { status: 'expired', label: '5 stars in 2018, rating lapsed' }, fuelPer100: 3.9, kwhPer100: null, rangeKm: null, energy: '3.9 L/100 km', warrantyYears: 5, warrantyKm: null, warranty: '5 years, unlimited km',
  serviceIntervalMonths: 12, serviceIntervalKm: 15000, servicingCostYear: 250, safetyFeatures: ['aeb'], highlights: ['Cheap to run'], asAt: '2025 model year, indicative list prices before on-road costs', sourceUrl: null,
  ratingAvg: 0, ratingCount: 0, reliabilityAvg: 0, co2GramsKm: null, emissions: '', isActive: true, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', lastCheck: null,
  flags: [{ key: 'UNCHECKED', words: 'Never checked by the team: these are the starter figures' }, { key: 'NO_SOURCE', words: 'No source link' }], due: true,
};
const REFERENCE = {
  bodyTypes: [{ key: 'HATCH', label: 'Hatch', blurb: '' }, { key: 'SUV', label: 'SUV', blurb: '' }],
  fuelTypes: [{ key: 'HYBRID', label: 'Hybrid', blurb: '' }, { key: 'PETROL', label: 'Petrol', blurb: '' }],
  safetyFeatures: [{ key: 'aeb', name: 'Autonomous emergency braking', what: '', why: '', lookFor: '' }],
};

const today = () => `Checked ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}: list price before on-road costs`;

beforeEach(() => {
  mockGet.mockReset().mockImplementation(async (url: string) => ({ data: { data: url === '/automotive/admin/catalogue' ? { models: [CAR], counts: { active: 1, retired: 0, due: 1 }, recheckDays: 180, columns: [] } : REFERENCE } }));
  mockPost.mockReset().mockResolvedValue({ data: { data: {} } });
  mockPatch.mockReset().mockResolvedValue({ data: { data: {} } });
});

async function openEditor() {
  render(<CatalogueAdminPage />);
  await screen.findByText(/Never checked by the team\./);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
}

describe('The admin catalogue page', () => {
  it('shows a starter row as never checked, with what needs looking at', async () => {
    render(<CatalogueAdminPage />);
    expect(await screen.findByText(/Never checked by the team\./)).toBeInTheDocument();
    expect(screen.getByText(/No source link/)).toBeInTheDocument();
  });

  it('sends a changed price with a fresh as-at, and nothing it did not change', async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText(/^List price from/), { target: { value: '33990' } });
    expect(screen.getByLabelText(/^As at/)).toHaveValue(today());
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/automotive/admin/catalogue/car-1', { priceFrom: 33990, asAt: today() }));
  });

  it('does not pass a change of wording off as a check', async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText(/^Highlights/), { target: { value: 'Cheap to run\nQuiet in town' } });
    expect(screen.getByLabelText(/^As at/)).toHaveValue(CAR.asAt);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/automotive/admin/catalogue/car-1', { highlights: ['Cheap to run', 'Quiet in town'] }));
  });

  it('records "checked, still right" with today\'s as-at and the source', async () => {
    render(<CatalogueAdminPage />);
    await screen.findByText(/Never checked by the team\./);
    fireEvent.click(screen.getByRole('button', { name: 'Checked, still right' }));
    fireEvent.change(screen.getByLabelText(/^Source/), { target: { value: 'https://www.toyota.com.au/corolla/hatch/prices' } });
    fireEvent.click(screen.getByRole('button', { name: 'It is still right' }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/automotive/admin/catalogue/car-1/checked', { asAt: today(), sourceUrl: 'https://www.toyota.com.au/corolla/hatch/prices' }));
  });
});
