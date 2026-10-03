import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The public name on the profile settings page. ATHENA tells members they can use
 * a pseudonym on the platform, and until this field existed no screen let them: the
 * name other members see was filled from the legal one at sign-up and could not be
 * changed from the web or the phone. The server keeps the legal first and last name
 * off every social surface; this is where she chooses what to be called instead.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

const mutate = jest.fn();
let currentUser: Record<string, unknown> = {};
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({ user: currentUser }),
  useUpdateProfile: () => ({ mutate, isPending: false }),
  useMySkills: () => ({ data: [] }),
  useAddSkill: () => ({ mutate: jest.fn() }),
  useRemoveSkill: () => ({ mutate: jest.fn() }),
}));
// The identity card above the form is its own feature; it is left loading here.
jest.mock('@/lib/woman-gate', () => ({
  fetchIdentityGates: jest.fn(() => new Promise(() => undefined)),
  saveDateOfBirth: jest.fn(),
  womanGateApi: { request: jest.fn(), complete: jest.fn() },
}));

import ProfileSettingsPage from './page';

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProfileSettingsPage />
    </QueryClientProvider>
  );
};

describe('Public name on the profile settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { firstName: 'Jane', lastName: 'Doe', displayName: 'Jane Doe', headline: 'Product lead', bio: '', persona: 'EARLY_CAREER', profile: {} };
  });

  it('offers a public name, says it can differ from her real name, and says where her real name is used', () => {
    renderPage();

    const field = screen.getByLabelText('Public name');
    expect(field).toHaveValue('Jane Doe');
    expect(field).toBeDisabled();
    const help = screen.getByText(/It can be different from your real name/);
    expect(help).toHaveTextContent('Your real name is not shown on them');
    // Where her real name is used is said in full: an application or a booking shows it to the employer or mentor she chose.
    expect(help).toHaveTextContent('a payment, an identity check you choose to do, an application or booking you make, or the law');
    expect(field).toHaveAttribute('aria-describedby', 'displayName-help');
  });

  it('saves a pseudonym as the public name, and shows her as she will be seen while she types', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

    fireEvent.change(screen.getByLabelText('Public name'), { target: { value: 'Willow Rain' } });
    expect(screen.getByText('Other members will see you as: Willow Rain')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toMatchObject({ displayName: 'Willow Rain', firstName: 'Jane', lastName: 'Doe' });
  });

  it('calls her by her first name alone when the public name is emptied', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

    fireEvent.change(screen.getByLabelText('Public name'), { target: { value: '' } });

    expect(screen.getByText('Other members will see you as: Jane')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0].displayName).toBe('');
  });

  it('does not send the public name when she changed something else, so an old name that would not pass today cannot stop her saving', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

    fireEvent.change(screen.getByPlaceholderText(/Senior Product Manager/), { target: { value: 'Head of Product' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const sent = mutate.mock.calls[0][0];
    expect(sent.headline).toBe('Head of Product');
    expect(Object.keys(sent)).not.toContain('displayName');
  });
});

