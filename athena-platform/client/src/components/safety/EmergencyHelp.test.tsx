import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Emergency help is the one control a woman reaches for when something is
 * wrong, so these hold it to what it promises: it is there, it opens at once, it
 * lists the numbers as links that dial, it leaves ATHENA when asked, and none of
 * that waits on the API.
 */

let signedIn = true;
let memberRegion: string | undefined;
jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ isAuthenticated: signedIn, isLoading: false, user: signedIn ? { region: memberRegion } : null }),
}));

let currentPath: string | null = '/jobs';
jest.mock('next/navigation', () => ({ usePathname: () => currentPath }));

const getSettings = jest.fn();
jest.mock('@/lib/api', () => ({ dvSafeApi: { getSettings: () => getSettings() } }));

import { EmergencyHelp, SignedInEmergencyHelp } from './EmergencyHelp';
import { QuickExitButton, exitNavigation, resetFloatingExitClaims } from '@/app/dashboard/safety/QuickExit';

let client: QueryClient;
function withQueries(children: ReactNode) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /emergency help/i }));

/**
 * Waits until her settings have been read, or refused, and drawn. react-query
 * hands a query's answer to the component on a timer (its notifyManager runs on
 * setTimeout 0), not on the microtask queue, so a single microtask turn after
 * the mock had resolved raced that timer and the exit was pressed before its
 * address had arrived. The cache says when the answer is in, and one timer turn
 * inside act is what lets it reach the dialog.
 */
async function settled() {
  await waitFor(() => expect(['success', 'error']).toContain(client.getQueryState(['dv-safe-settings'])?.status));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  signedIn = true;
  memberRegion = undefined;
  currentPath = '/jobs';
  getSettings.mockReset();
  getSettings.mockResolvedValue({ data: { safeExitUrl: 'https://www.bom.gov.au', safeExitEnabled: false } });
  act(() => resetFloatingExitClaims());
});

describe('the Emergency help button', () => {
  it('is there, with a word on it, before anything has loaded', () => {
    // Nothing about her settings has answered yet, and the page has no data.
    getSettings.mockReturnValue(new Promise(() => undefined));

    render(withQueries(<EmergencyHelp />));

    expect(screen.getByRole('button', { name: /emergency help/i })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a dialog with 000, 1800RESPECT and Lifeline as links that dial', () => {
    render(withQueries(<EmergencyHelp />));

    open();

    const dialog = screen.getByRole('dialog', { name: /emergency help/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('link', { name: /Emergency 000/ })).toHaveAttribute('href', 'tel:000');
    expect(within(dialog).getByRole('link', { name: /1800RESPECT 1800 737 732/ })).toHaveAttribute('href', 'tel:1800737732');
    expect(within(dialog).getByRole('link', { name: /Lifeline 13 11 14/ })).toHaveAttribute('href', 'tel:131114');
  });

  it('says plainly that ATHENA cannot send anyone', () => {
    render(withQueries(<EmergencyHelp />));

    open();

    expect(screen.getByRole('dialog')).toHaveTextContent(/ATHENA cannot send anyone to you/i);
  });

  it('links to the report form and the Safety centre', () => {
    render(withQueries(<EmergencyHelp />));

    open();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: /report a problem/i })).toHaveAttribute('href', '/report');
    expect(within(dialog).getByRole('link', { name: /safety centre/i })).toHaveAttribute('href', '/safety-center');
  });

  it('gives the numbers of her own country when her region is not Australia', () => {
    render(withQueries(<EmergencyHelp region="UK" />));

    open();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: /Emergency 999/ })).toHaveAttribute('href', 'tel:999');
    expect(within(dialog).queryByRole('link', { name: /Emergency 000/ })).not.toBeInTheDocument();
  });

  it('opens and lists the numbers when her settings cannot be read at all', async () => {
    getSettings.mockRejectedValue(new Error('Network Error'));

    render(withQueries(<EmergencyHelp />));
    await act(async () => {
      await Promise.resolve();
    });
    open();

    expect(within(screen.getByRole('dialog')).getByRole('link', { name: /Emergency 000/ })).toBeInTheDocument();
  });

  it('opens for a visitor who is not signed in, and asks the server nothing', () => {
    signedIn = false;

    render(withQueries(<EmergencyHelp />));
    open();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(getSettings).not.toHaveBeenCalled();
  });
});

describe('leaving', () => {
  let replace: jest.SpyInstance;

  beforeEach(() => {
    // A test browser cannot navigate; what matters is where it was told to go.
    replace = jest.spyOn(exitNavigation, 'replace').mockImplementation(() => undefined);
  });
  afterEach(() => {
    replace.mockRestore();
  });

  it('Quick exit in the dialog goes to the address she chose', async () => {
    render(withQueries(<EmergencyHelp />));
    open();
    // Her settings arrive once the dialog is open and the exit is asking.
    await settled();

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /quick exit/i }));

    expect(replace).toHaveBeenCalledWith('https://www.bom.gov.au');
  });

  it('Quick exit in the dialog still leaves, for the default page, when her settings cannot be read', async () => {
    getSettings.mockRejectedValue(new Error('Network Error'));
    render(withQueries(<EmergencyHelp />));
    open();
    await settled();

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /quick exit/i }));

    expect(replace).toHaveBeenCalledWith('https://www.google.com');
  });
});

describe('closing', () => {
  it('closes with Escape and gives the focus back to the button', () => {
    render(withQueries(<EmergencyHelp />));
    open();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /emergency help/i })).toHaveFocus();
  });

  it('closes from its own close button and from a press on the backdrop', () => {
    render(withQueries(<EmergencyHelp />));

    open();
    fireEvent.click(screen.getByRole('button', { name: /close emergency help/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    open();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps Tab inside the dialog while it is open', () => {
    render(withQueries(<EmergencyHelp />));
    open();
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const last = focusable[focusable.length - 1];

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });

    expect(focusable[0]).toHaveFocus();
  });
});

describe('on every page a signed-in member can be on', () => {
  it('is there for a signed-in member on a page outside the dashboard, and opens on the numbers to ring', () => {
    render(withQueries(<SignedInEmergencyHelp />));

    open();

    const dialog = screen.getByRole('dialog', { name: /emergency help/i });
    expect(within(dialog).getByRole('link', { name: /Emergency 000/ })).toHaveAttribute('href', 'tel:000');
    expect(within(dialog).getByRole('link', { name: /1800RESPECT 1800 737 732/ })).toHaveAttribute('href', 'tel:1800737732');
  });

  it('is not drawn for a visitor with no account, whose pages carry the numbers in the footer', () => {
    signedIn = false;
    render(withQueries(<SignedInEmergencyHelp />));

    expect(screen.queryByRole('button', { name: /emergency help/i })).not.toBeInTheDocument();
  });

  it("gives a member the numbers of her own country, from the region on her profile", () => {
    memberRegion = 'UK';
    render(withQueries(<SignedInEmergencyHelp />));

    open();

    const dialog = screen.getByRole('dialog', { name: /emergency help/i });
    expect(within(dialog).getByRole('link', { name: /Emergency 999/ })).toHaveAttribute('href', 'tel:999');
    expect(within(dialog).queryByRole('link', { name: /1800RESPECT/ })).not.toBeInTheDocument();
  });

  it('is one button, not two, under a layout or a page that carries its own', () => {
    render(
      withQueries(
        <>
          <EmergencyHelp />
          <SignedInEmergencyHelp />
        </>
      )
    );

    expect(screen.getAllByRole('button', { name: /emergency help/i })).toHaveLength(1);
  });

  it("drops below the reels' action buttons on the reels page, and stays in its usual corner elsewhere", () => {
    currentPath = '/explore';
    const { unmount } = render(withQueries(<SignedInEmergencyHelp />));
    const onReels = screen.getByRole('button', { name: /emergency help/i });
    expect(onReels.className).toContain('bottom-4');
    expect(onReels.className).not.toContain('bottom-[4.75rem]');
    unmount();
    act(() => resetFloatingExitClaims());

    currentPath = '/jobs';
    render(withQueries(<SignedInEmergencyHelp />));
    expect(screen.getByRole('button', { name: /emergency help/i }).className).toContain('bottom-[4.75rem]');
  });
});

describe('with the rest of the page', () => {
  it('draws one button when a layout and a page both carry it', () => {
    render(
      withQueries(
        <>
          <EmergencyHelp />
          <EmergencyHelp />
        </>
      )
    );

    expect(screen.getAllByRole('button', { name: /emergency help/i })).toHaveLength(1);
  });

  it('sits beside the floating quick exit without taking its place', () => {
    render(
      withQueries(
        <>
          <QuickExitButton variant="floating" />
          <EmergencyHelp />
        </>
      )
    );

    expect(screen.getAllByRole('button', { name: /quick exit/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /emergency help/i })).toHaveLength(1);
  });

  it('falls back to a plain link that dials 000 if the control itself fails', () => {
    // Without a QueryClientProvider the quick exit inside the dialog cannot
    // start, which is a failure of the kind the boundary is there for.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<EmergencyHelp />);

    fireEvent.click(screen.getByRole('button', { name: /emergency help/i }));

    expect(screen.getByRole('link', { name: /emergency 000/i })).toHaveAttribute('href', 'tel:000');
    consoleError.mockRestore();
  });
});
