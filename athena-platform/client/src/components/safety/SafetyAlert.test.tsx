import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The safety alert used to be reachable from one place, a section of her Safety
 * settings, which is almost never the page she is on when she needs it. It is in
 * Emergency help now, which is on every page. These hold it to what it promises:
 * it is offered only when it can work, it cannot be sent by a single stray press,
 * and what she is told afterwards is what the server says happened.
 */

let signedIn = true;
jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ isAuthenticated: signedIn, isLoading: false, user: signedIn ? { region: 'AU' } : null }),
}));

jest.mock('next/navigation', () => ({ usePathname: () => '/jobs' }));

const getSettings = jest.fn();
const panic = jest.fn();
jest.mock('@/lib/api', () => ({ dvSafeApi: { getSettings: () => getSettings(), panic: () => panic() } }));

import { EmergencyHelp } from './EmergencyHelp';
import { resetFloatingExitClaims } from '@/app/dashboard/safety/QuickExit';

let client: QueryClient;
function withQueries(children: ReactNode) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const contact = (over: Record<string, unknown> = {}) => ({ id: 'c1', name: 'Mum', notifyOnPanic: true, ...over });
const settings = (over: Record<string, unknown> = {}) => ({
  data: { safeExitUrl: 'https://www.bom.gov.au', safeExitEnabled: false, panicButtonEnabled: true, emergencyContacts: [contact()], ...over },
});

/**
 * Waits until her settings have been read and drawn.
 *
 * react-query hands a query's answer to the component on a timer (its
 * notifyManager runs on setTimeout 0), not on the microtask queue, so counting
 * microtasks once the mock had resolved raced that timer: whichever of the two
 * was registered first won, and this file passed on its own and failed in a
 * batch. The cache says when the answer is in, and one timer turn inside act
 * is what lets it reach the dialog.
 */
async function settled() {
  await waitFor(() => expect(['success', 'error']).toContain(client.getQueryState(['dv-safe-settings'])?.status));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openDialog() {
  render(withQueries(<EmergencyHelp />));
  fireEvent.click(screen.getByRole('button', { name: /emergency help/i }));
  // Her settings are asked for once the dialog is open; wait until they have been
  // read and drawn, so a test that expects nothing to be offered is not looking
  // before the answer came.
  await settled();
  return screen.getByRole('dialog');
}

beforeEach(() => {
  signedIn = true;
  getSettings.mockReset();
  panic.mockReset();
  getSettings.mockResolvedValue(settings());
  act(() => resetFloatingExitClaims());
});

describe('the safety alert in Emergency help', () => {
  it('is offered when she has switched it on and has a contact who is to be told', async () => {
    const dialog = await openDialog();

    expect(within(dialog).getByRole('heading', { name: /tell my emergency contacts/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /send my safety alert/i })).toBeInTheDocument();
  });

  it('is not offered when the alert is switched off', async () => {
    getSettings.mockResolvedValue(settings({ panicButtonEnabled: false }));

    const dialog = await openDialog();

    expect(within(dialog).queryByRole('button', { name: /send my safety alert/i })).not.toBeInTheDocument();
  });

  it('is not offered when nobody is set to be told, because a button that can only say so wastes her time', async () => {
    getSettings.mockResolvedValue(settings({ emergencyContacts: [contact({ notifyOnPanic: false }), contact({ id: 'c2', notifyOnPanic: false })] }));

    const dialog = await openDialog();

    expect(within(dialog).queryByRole('button', { name: /send my safety alert/i })).not.toBeInTheDocument();
  });

  it('is not offered to a visitor who is not signed in, and asks the server nothing', () => {
    signedIn = false;

    render(withQueries(<EmergencyHelp />));
    fireEvent.click(screen.getByRole('button', { name: /emergency help/i }));

    expect(screen.queryByRole('button', { name: /send my safety alert/i })).not.toBeInTheDocument();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it('sends nothing on the first press: it asks once more, and says what it will do', async () => {
    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: /send my safety alert/i }));

    expect(panic).not.toHaveBeenCalled();
    // Not "emailed": a contact with only a phone number is texted, or not reached at all, and the page cannot know which.
    expect(dialog).toHaveTextContent(/sent a message asking them to reach you/i);
    expect(dialog).not.toHaveTextContent(/emailed/i);
    expect(dialog).toHaveTextContent(/cannot send anyone to you/i);
    expect(within(dialog).getByRole('button', { name: /yes, send it/i })).toBeInTheDocument();
  });

  it('sends nothing when she says not now, and offers it again', async () => {
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /send my safety alert/i }));

    fireEvent.click(within(dialog).getByRole('button', { name: /not now/i }));

    expect(panic).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: /send my safety alert/i })).toBeInTheDocument();
  });

  it('sends on the second press, and shows her the server’s own words about who was reached', async () => {
    panic.mockResolvedValue({
      data: {
        success: true,
        outcome: 'PARTIALLY_ALERTED',
        message: 'Your emergency contact Mum was emailed.',
        notifiedContacts: ['Mum'],
        unreachableContacts: ['Sam'],
      },
    });
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /send my safety alert/i }));

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /yes, send it/i }));
      await Promise.resolve();
    });

    expect(panic).toHaveBeenCalledTimes(1);
    const status = await within(dialog).findByRole('status');
    expect(status).toHaveTextContent('Your emergency contact Mum was emailed.');
    expect(status).toHaveTextContent(/could not reach sam: call them/i);
  });

  it('does not say it was sent when the server could not send it, and says to ring 000', async () => {
    panic.mockRejectedValue(new Error('Network Error'));
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /send my safety alert/i }));

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /yes, send it/i }));
      await Promise.resolve();
    });

    const status = await within(dialog).findByRole('status');
    expect(status).toHaveTextContent(/could not be sent/i);
    expect(status).toHaveTextContent(/call 000/i);
    expect(status).not.toHaveTextContent(/was emailed/i);
  });

  it('says "a message", not "email", before she sends it', async () => {
    const dialog = await openDialog();

    expect(dialog).toHaveTextContent(/sends a message to the people you chose/i);
    expect(dialog).not.toHaveTextContent(/emails the people/i);
  });

  it('offers another go when the alert could not be sent, and asks her to confirm again before it sends', async () => {
    panic.mockRejectedValueOnce(new Error('Network Error'));
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /send my safety alert/i }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /yes, send it/i }));
      await Promise.resolve();
    });
    await within(dialog).findByRole('status');

    fireEvent.click(within(dialog).getByRole('button', { name: /try again/i }));

    // Back at the confirmation: nothing is sent until she presses it.
    expect(panic).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('button', { name: /yes, send it/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not offer another go once somebody has been reached', async () => {
    panic.mockResolvedValue({ data: { success: true, outcome: 'ALERTED', message: 'Mum has been told and asked to reach you now.' } });
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /send my safety alert/i }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /yes, send it/i }));
      await Promise.resolve();
    });

    await within(dialog).findByRole('status');

    expect(within(dialog).queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('shows what the server said when nobody could be reached, without turning it into good news', async () => {
    panic.mockResolvedValue({
      data: { success: false, outcome: 'NOBODY_REACHED', message: 'No message reached anyone. Call your contacts yourself.', unreachableContacts: ['Mum'] },
    });
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /send my safety alert/i }));

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /yes, send it/i }));
      await Promise.resolve();
    });

    const status = await within(dialog).findByRole('status');
    expect(status).toHaveTextContent('No message reached anyone. Call your contacts yourself.');
    expect(status).toHaveTextContent(/could not reach mum: call them/i);
  });
});
