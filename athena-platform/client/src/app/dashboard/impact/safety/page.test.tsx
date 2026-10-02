import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The safety plan page's promise about her own plan.
 *
 * The page used to say "private and encrypted" when nothing encrypted it, then
 * dropped the word. The plan is sealed on the server now, but a plan saved
 * before that is readable in the database until she saves it again, so the page
 * words its promise from what the server says about her own row, never from a
 * promise made for everyone. It also owns two things the server cannot do for
 * it: not saving a blank over a part it could not open, and asking twice before
 * a whole plan is deleted.
 */

jest.mock('@/lib/api', () => ({
  impactApi: {
    getSafetyPlan: jest.fn(),
    getDVServices: jest.fn(),
    saveSafetyPlan: jest.fn(),
    deleteSafetyPlan: jest.fn(),
  },
}));
// Quick exit has its own tests; here it only has to be there.
jest.mock('../../safety/QuickExit', () => ({ QuickExitButton: () => <button type="button">Quick exit</button> }));

import SafetyPage from './page';
import { impactApi } from '@/lib/api';

const api = impactApi as unknown as {
  getSafetyPlan: jest.Mock;
  getDVServices: jest.Mock;
  saveSafetyPlan: jest.Mock;
  deleteSafetyPlan: jest.Mock;
};

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  emergencyContacts: ['Jo - 0400 000 000 - sister'],
  safeLocations: ['Library on Adelaide St'],
  warningTriggers: null,
  exitStrategies: ['Take the 6pm bus'],
  importantDocs: null,
  financialPlan: null,
  legalContacts: null,
  encryptedAtRest: true,
  unreadableParts: [],
  ...overrides,
});

const servedPlan = (value: ReturnType<typeof plan> | null) => api.getSafetyPlan.mockResolvedValue({ data: { data: value } });

beforeEach(() => {
  jest.clearAllMocks();
  api.getDVServices.mockResolvedValue({ data: { data: [], fallback: [] } });
  api.saveSafetyPlan.mockResolvedValue({ data: { success: true } });
  api.deleteSafetyPlan.mockResolvedValue({ data: { success: true, data: { deleted: true } } });
});

describe('What the page promises about her plan', () => {
  it('says it is encrypted only when the server says her own plan is', async () => {
    servedPlan(plan({ encryptedAtRest: true }));
    render(<SafetyPage />);

    expect(await screen.findByText(/It is encrypted on ATHENA/)).toBeInTheDocument();
    expect(screen.queryByText(/not encrypted yet/)).not.toBeInTheDocument();
  });

  it('says it is not encrypted yet while a part is still readable, and what to do about it', async () => {
    servedPlan(plan({ encryptedAtRest: false }));
    render(<SafetyPage />);

    expect(await screen.findByText(/not encrypted yet/)).toBeInTheDocument();
    expect(screen.getByText(/pressing Update and then Save plan encrypts it/)).toBeInTheDocument();
    expect(screen.queryByText(/It is encrypted on ATHENA/)).not.toBeInTheDocument();
  });

  it('does not claim that nobody at all could read it: the people who run the servers hold the key', async () => {
    servedPlan(plan());
    render(<SafetyPage />);

    const promise = await screen.findByText(/It is encrypted on ATHENA/);
    expect(promise.textContent).toMatch(/The people who look after our servers hold the key/);
    expect(promise.textContent).not.toMatch(/not staff/);
  });

  it('keeps quick exit on the page where she writes down where she could go', async () => {
    servedPlan(plan());
    render(<SafetyPage />);

    expect(await screen.findByRole('button', { name: 'Quick exit' })).toBeInTheDocument();
  });
});

describe('A part ATHENA could not open', () => {
  it('says so, shows nothing for it, and does not save a blank over it', async () => {
    servedPlan(plan({ safeLocations: null, unreadableParts: ['safeLocations'] }));
    render(<SafetyPage />);

    expect(await screen.findByText(/could not be opened just now/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Update plan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() => expect(api.saveSafetyPlan).toHaveBeenCalledTimes(1));
    const sent = api.saveSafetyPlan.mock.calls[0][0];
    // The box she could not see is left out, so what is stored stays as it is.
    expect(sent).not.toHaveProperty('safeLocations');
    expect(sent.emergencyContacts).toEqual(['Jo - 0400 000 000 - sister']);
    // A box she emptied herself is still sent as empty: that is how she deletes a line.
    expect(sent.warningTriggers).toEqual([]);
  });

  it('does not call her plan empty when what it holds is the part it could not open', async () => {
    servedPlan(plan({ emergencyContacts: null, safeLocations: null, exitStrategies: null, unreadableParts: ['safeLocations'] }));
    render(<SafetyPage />);

    expect(await screen.findByText(/Nothing can be shown here just now/)).toBeInTheDocument();
    expect(screen.queryByText(/Your plan is empty/)).not.toBeInTheDocument();
  });

  it('saves what she writes there, which replaces what is stored', async () => {
    servedPlan(plan({ safeLocations: null, unreadableParts: ['safeLocations'] }));
    render(<SafetyPage />);

    await screen.findByText(/could not be opened just now/);
    fireEvent.click(screen.getByRole('button', { name: /Update plan/ }));
    fireEvent.change(screen.getByLabelText('Safe places'), { target: { value: 'Mum’s place' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() => expect(api.saveSafetyPlan).toHaveBeenCalledTimes(1));
    expect(api.saveSafetyPlan.mock.calls[0][0].safeLocations).toEqual(['Mum’s place']);
  });
});

describe('Deleting the whole plan', () => {
  it('asks once more, and a tap on "Keep it" leaves the plan alone', async () => {
    servedPlan(plan());
    render(<SafetyPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Delete my whole plan/ }));
    expect(screen.getByText(/Delete your whole safety plan\? This cannot be undone\./)).toBeInTheDocument();
    expect(api.deleteSafetyPlan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(screen.queryByText(/Delete your whole safety plan\?/)).not.toBeInTheDocument();
    expect(api.deleteSafetyPlan).not.toHaveBeenCalled();
  });

  it('removes the plan on the second tap, and the page then shows none', async () => {
    servedPlan(plan());
    render(<SafetyPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Delete my whole plan/ }));
    servedPlan(null);
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete it/ }));

    await waitFor(() => expect(api.deleteSafetyPlan).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: /Create plan/ })).toBeInTheDocument();
    // There is nothing left to delete, so the button is gone with the plan.
    expect(screen.queryByRole('button', { name: /Delete my whole plan/ })).not.toBeInTheDocument();
  });

  it('says so, and keeps the plan on screen, when the server could not delete it', async () => {
    servedPlan(plan());
    api.deleteSafetyPlan.mockRejectedValue({ response: { data: { error: 'Try again in a moment.' } } });
    render(<SafetyPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Delete my whole plan/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete it/ }));

    expect(await screen.findByText('Try again in a moment.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update plan/ })).toBeInTheDocument();
  });

  it('offers nothing to delete before she has made a plan', async () => {
    servedPlan(null);
    render(<SafetyPage />);

    expect(await screen.findByRole('button', { name: /Create plan/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete my whole plan/ })).not.toBeInTheDocument();
  });
});
