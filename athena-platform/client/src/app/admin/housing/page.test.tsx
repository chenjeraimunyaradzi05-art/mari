import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The staff safety check on housing. Marking a place "Checked by ATHENA staff"
 * is a promise to a woman in a hard moment, so the screen holds staff to what the
 * server holds them to: a record of what they checked, and a standing provider
 * check on whoever listed it. The approve button stays off until both are there,
 * and the server's refusal is shown as its own sentence if the screen is wrong.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({
  housingApi: {
    getPendingSafetyChecks: jest.fn(),
    adminUpdateListing: jest.fn(),
    getProviderChecks: jest.fn(),
    decideProviderCheck: jest.fn(),
  },
}));

import toast from 'react-hot-toast';
import { housingApi } from '@/lib/api';
import AdminHousingPage from './page';

const api = housingApi as unknown as { getPendingSafetyChecks: jest.Mock; adminUpdateListing: jest.Mock; getProviderChecks: jest.Mock; decideProviderCheck: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const lister = { id: 'lister-1', firstName: 'Ada', lastName: 'L', displayName: null, email: 'ada@example.com', womanVerificationStatus: 'VERIFIED', createdAt: '2026-01-01T00:00:00.000Z' };

const listing = (over: Record<string, unknown> = {}) => ({
  id: 'l-1',
  title: 'Quiet unit',
  description: 'Secure entry.',
  type: 'RENTAL',
  status: 'PENDING',
  dvSafe: true,
  address: '7 Hidden Lane',
  suburb: 'Ashgrove',
  city: 'Brisbane',
  state: 'QLD',
  postcode: '4060',
  rentWeekly: 400,
  bedrooms: 2,
  bathrooms: 1,
  features: [],
  dvSafeNote: 'I live upstairs and nobody else has the address.',
  images: null,
  createdAt: new Date().toISOString(),
  lister,
  providerCheck: { standing: 'APPROVED', expiresAt: '2027-06-30T00:00:00.000Z' },
  ...over,
});

const queue = (rows: unknown[]) => ({ data: { data: rows } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminHousingPage />
    </QueryClientProvider>
  );
}

const open = async (title = 'Quiet unit') => {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(title) }));
};

beforeEach(() => {
  jest.clearAllMocks();
  api.getProviderChecks.mockResolvedValue({ data: { data: { waiting: [], ending: [] } } });
  api.adminUpdateListing.mockResolvedValue({ data: { data: {} } });
});

describe('Approving a listing', () => {
  it('stays off until the member of staff says what they checked, and the lister has a standing provider check', async () => {
    api.getPendingSafetyChecks.mockResolvedValue(queue([listing()]));
    renderPage();
    await open();

    const approve = screen.getByRole('button', { name: 'Approve as DV-safe' });
    expect(approve).toBeDisabled();
    expect(screen.getByText(/say what you checked/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/What you checked/), { target: { value: 'ok' } });
    expect(approve).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/What you checked/), { target: { value: 'Rang the refuge manager and confirmed the secure entry.' } });
    expect(approve).toBeEnabled();
  });

  it('sends the note of what was checked with the approval, and keeps the line for the lister apart', async () => {
    api.getPendingSafetyChecks.mockResolvedValue(queue([listing()]));
    renderPage();
    await open();

    fireEvent.change(screen.getByLabelText(/What you checked/), { target: { value: 'Rang the refuge manager and confirmed the secure entry.' } });
    fireEvent.change(screen.getByLabelText(/A line for the lister/), { target: { value: 'Thank you for your patience.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve as DV-safe' }));

    await waitFor(() => expect(api.adminUpdateListing).toHaveBeenCalledTimes(1));
    expect(api.adminUpdateListing).toHaveBeenCalledWith('l-1', {
      safetyVerified: true,
      dvSafe: true,
      status: 'ACTIVE',
      checkNote: 'Rang the refuge manager and confirmed the secure entry.',
      note: 'Thank you for your patience.',
    });
  });

  it.each([
    ['has never asked to be checked', 'NONE', 'No provider check yet'],
    ['is waiting for a decision', 'PENDING', 'Provider check waiting for a decision'],
    ['was refused', 'REJECTED', 'Provider check was refused'],
    ['had one that ended', 'EXPIRED', 'Provider check has ended'],
  ])('keeps approve off, and says why, when the lister %s', async (_what, standing, text) => {
    api.getPendingSafetyChecks.mockResolvedValue(queue([listing({ providerCheck: { standing, expiresAt: null } })]));
    renderPage();
    await open();

    fireEvent.change(screen.getByLabelText(/What you checked/), { target: { value: 'Rang the refuge manager and confirmed the secure entry.' } });

    expect(screen.getByRole('button', { name: 'Approve as DV-safe' })).toBeDisabled();
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
    expect(screen.getByText(/A place cannot be marked checked until this is approved/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Provider checks' })).toHaveAttribute('href', '#provider-checks');
  });

  it('shows the server’s refusal as its own sentence', async () => {
    api.getPendingSafetyChecks.mockResolvedValue(queue([listing()]));
    api.adminUpdateListing.mockRejectedValue({ response: { data: { message: 'The person offering this place has not been checked by ATHENA yet.' } } });
    renderPage();
    await open();

    fireEvent.change(screen.getByLabelText(/What you checked/), { target: { value: 'Rang the refuge manager and confirmed the secure entry.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve as DV-safe' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('The person offering this place has not been checked by ATHENA yet.'));
  });
});

describe('An emergency or transitional listing', () => {
  const emergency = () => listing({ id: 'l-2', title: 'Emergency bed', type: 'EMERGENCY', dvSafe: false, dvSafeNote: null });

  it('is in the queue, is approved as itself rather than as DV-safe, and has no ordinary version', async () => {
    api.getPendingSafetyChecks.mockResolvedValue(queue([emergency()]));
    renderPage();
    await open('Emergency bed');

    expect(screen.queryByRole('button', { name: 'Show as ordinary listing' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/What you checked/), { target: { value: 'Visited the property with the owner and saw the room.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve as checked' }));

    await waitFor(() => expect(api.adminUpdateListing).toHaveBeenCalledTimes(1));
    const body = api.adminUpdateListing.mock.calls[0][1];
    expect(body).toMatchObject({ safetyVerified: true, status: 'ACTIVE', checkNote: 'Visited the property with the owner and saw the room.' });
    // It never claimed to be DV-safe, so approving it does not say it is.
    expect(body).not.toHaveProperty('dvSafe');
  });

  it('a DV-safe claim on an ordinary rental can still be shown as an ordinary listing, which needs no check', async () => {
    api.getPendingSafetyChecks.mockResolvedValue(queue([listing()]));
    api.adminUpdateListing.mockResolvedValue({ data: {} });
    renderPage();
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Show as ordinary listing' }));

    await waitFor(() => expect(api.adminUpdateListing).toHaveBeenCalledWith('l-1', { dvSafe: false, status: 'ACTIVE' }));
  });
});

describe('The queue', () => {
  it('says so when nothing is waiting, and when it cannot load', async () => {
    api.getPendingSafetyChecks.mockResolvedValue(queue([]));
    const { unmount } = renderPage();
    expect(await screen.findByText('Nothing waiting for a check.')).toBeInTheDocument();
    unmount();

    api.getPendingSafetyChecks.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByText('Could not load the queue.')).toBeInTheDocument();
  });

  it('carries the Provider checks list on the same page', async () => {
    api.getPendingSafetyChecks.mockResolvedValue(queue([]));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Provider checks' })).toBeInTheDocument();
    expect(await screen.findByText(/No provider checks are waiting/)).toBeInTheDocument();
  });
});
