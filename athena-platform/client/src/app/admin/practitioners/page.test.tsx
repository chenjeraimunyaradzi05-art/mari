import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The practitioner approval queue. "Verified" on a practitioner is a promise to
 * a woman booking a psychologist, so the screen holds the admin to what the
 * server holds them to: a record of where they looked the practitioner up and
 * what they found. The Verify button stays off until both are there; Hide
 * vouches for nothing and needs no record.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/wellness-api', () => ({
  wellnessApi: { pendingPractitioners: jest.fn(), verifyPractitioner: jest.fn() },
  wellnessError: (_err: unknown, fallback: string) => fallback,
}));

import { wellnessApi } from '@/lib/wellness-api';
import AdminPractitionersPage from './page';

const api = wellnessApi as unknown as { pendingPractitioners: jest.Mock; verifyPractitioner: jest.Mock };

const pending = {
  id: 'pr-new',
  slug: 'dr-new',
  name: 'Dr New',
  kind: 'PSYCHOLOGIST',
  kindLabel: 'Psychologist',
  headline: 'A perinatal psychologist',
  bio: 'Twenty years of perinatal work in Brisbane.',
  qualifications: ['MPsych'],
  specialties: [],
  suburb: null,
  city: 'Brisbane',
  state: 'QLD',
  ahpraNumber: 'PSY0001234567',
  website: null,
  phone: null,
  telehealth: true,
  inPerson: false,
  createdAt: new Date().toISOString(),
  owner: { id: 'doctor', name: 'Kate New', email: 'kate@example.org' },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminPractitionersPage />
    </QueryClientProvider>
  );
}

const open = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Dr New/ }));
};

beforeEach(() => {
  jest.clearAllMocks();
  api.pendingPractitioners.mockResolvedValue({ data: { data: [pending] } });
  api.verifyPractitioner.mockResolvedValue({ data: { data: {} } });
});

describe('Verifying a practitioner', () => {
  it('stays off until the admin says what they found, then sends the register and the note', async () => {
    renderPage();
    await open();

    const verify = screen.getByRole('button', { name: 'Verify' });
    expect(verify).toBeDisabled();
    expect(screen.getByText(/say what you found/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/What you found/), { target: { value: 'ok' } });
    expect(verify).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/What you found/), { target: { value: 'Name and number match the register; registration current, no conditions.' } });
    expect(verify).toBeEnabled();

    fireEvent.click(verify);
    await waitFor(() =>
      expect(api.verifyPractitioner).toHaveBeenCalledWith('pr-new', {
        isVerified: true,
        checkedAgainst: 'AHPRA',
        checkNote: 'Name and number match the register; registration current, no conditions.',
      })
    );
  });

  it('asks for the professional body by name when AHPRA is not the register', async () => {
    renderPage();
    await open();

    fireEvent.change(screen.getByLabelText(/Where you looked/), { target: { value: 'PROFESSIONAL_BODY' } });
    fireEvent.change(screen.getByLabelText(/What you found/), { target: { value: 'Clinical member on the PACFA register; name and location match.' } });
    const verify = screen.getByRole('button', { name: 'Verify' });
    expect(verify).toBeDisabled();
    expect(screen.getByText(/name the body you checked with/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Which body'), { target: { value: 'PACFA' } });
    expect(verify).toBeEnabled();

    fireEvent.click(verify);
    await waitFor(() => expect(api.verifyPractitioner).toHaveBeenCalledWith('pr-new', expect.objectContaining({ isVerified: true, checkedAgainst: 'PROFESSIONAL_BODY', registerName: 'PACFA' })));
  });

  it('hides a profile with no check record, since nothing is being vouched for', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));

    await waitFor(() => expect(api.verifyPractitioner).toHaveBeenCalledWith('pr-new', { isVerified: false, isActive: false }));
    confirm.mockRestore();
  });

  it('does not carry one practitioner\'s check record over to the next', async () => {
    api.pendingPractitioners.mockResolvedValue({ data: { data: [pending, { ...pending, id: 'pr-two', slug: 'dr-two', name: 'Dr Two' }] } });
    renderPage();
    await open();
    fireEvent.change(screen.getByLabelText(/What you found/), { target: { value: 'Name and number match the register; registration current.' } });

    fireEvent.click(screen.getByRole('button', { name: /Dr Two/ }));

    expect(screen.getByLabelText(/What you found/)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });
});
