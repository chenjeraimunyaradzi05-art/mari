import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Quick exit is carried by section layouts and by single pages, and the
 * dashboard layout is meant to carry one for everything beneath it. A page
 * under two of those must still show one floating button, not two stacked in
 * the same corner, and the corner must never be empty while any of them is
 * mounted.
 */

let signedIn = false;
jest.mock('@/lib/hooks', () => ({
  useAuthStore: () => ({ isAuthenticated: signedIn, isLoading: false }),
}));

const getSettings = jest.fn();
jest.mock('@/lib/api', () => ({ dvSafeApi: { getSettings: () => getSettings() } }));

import { DEFAULT_EXIT_URL, DOUBLE_ESCAPE_MS, QuickExitButton, exitNavigation, resetFloatingExitClaims } from './QuickExit';

function withQueries(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const leave = jest.spyOn(exitNavigation, 'replace');

beforeEach(() => {
  signedIn = false;
  getSettings.mockReset();
  leave.mockReset();
  leave.mockImplementation(() => undefined);
  act(() => resetFloatingExitClaims());
});

afterEach(() => {
  jest.useRealTimers();
});

const escape = (init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key: 'Escape', ...init });

describe('QuickExitButton', () => {
  it('draws one floating exit when a layout and a page both ask for one', () => {
    render(
      withQueries(
        <>
          <QuickExitButton variant="floating" />
          <QuickExitButton variant="floating" />
        </>
      )
    );

    expect(screen.getAllByRole('button', { name: /quick exit/i })).toHaveLength(1);
  });

  it('leaves inline buttons alone: a header copy and the floating one both show', () => {
    render(
      withQueries(
        <>
          <QuickExitButton />
          <QuickExitButton variant="floating" />
        </>
      )
    );

    expect(screen.getAllByRole('button', { name: /quick exit/i })).toHaveLength(2);
  });

  it('hands the corner to the next floating copy when the drawn one goes', () => {
    function Page({ first }: { first: boolean }) {
      return (
        <>
          {first && <QuickExitButton variant="floating" className="first" />}
          <QuickExitButton variant="floating" className="second" />
        </>
      );
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <Page first />
      </QueryClientProvider>
    );
    expect(screen.getAllByRole('button', { name: /quick exit/i })).toHaveLength(1);

    rerender(
      <QueryClientProvider client={client}>
        <Page first={false} />
      </QueryClientProvider>
    );

    const remaining = screen.getAllByRole('button', { name: /quick exit/i });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveClass('second');
  });

  it('asks nothing of the server for a visitor who is not signed in', () => {
    render(withQueries(<QuickExitButton variant="floating" />));

    fireEvent.focus(screen.getByRole('button', { name: /quick exit/i }));
    expect(getSettings).not.toHaveBeenCalled();
  });
});

describe('leaving', () => {
  it('goes to an ordinary page when the button is pressed by someone who is not signed in', () => {
    const replaceState = jest.spyOn(window.history, 'replaceState');
    render(withQueries(<QuickExitButton variant="floating" />));

    fireEvent.click(screen.getByRole('button', { name: /quick exit/i }));

    expect(leave).toHaveBeenCalledWith(DEFAULT_EXIT_URL);
    // The entry for this page is replaced first, so Back from where she lands does not return here.
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    replaceState.mockRestore();
  });

  it('goes to the page she chose when she is signed in', async () => {
    signedIn = true;
    getSettings.mockResolvedValue({ data: { safeExitEnabled: false, safeExitUrl: 'https://www.bom.gov.au' } });
    render(withQueries(<QuickExitButton variant="floating" />));
    const button = await screen.findByRole('button', { name: /quick exit/i });

    // Her settings arrive a moment after the page; until they do, the button goes
    // to the default page, which is the point of it working on a bad signal. So it
    // is pressed until the address she chose is the one it goes to.
    await waitFor(() => {
      fireEvent.click(button);
      expect(leave).toHaveBeenLastCalledWith('https://www.bom.gov.au');
    });
  });
});

describe('the Escape key', () => {
  it('leaves on two Escapes in a row, for a visitor who is not signed in and has set nothing', () => {
    jest.useFakeTimers();
    render(withQueries(<QuickExitButton variant="floating" />));

    escape();
    expect(leave).not.toHaveBeenCalled();
    jest.advanceTimersByTime(DOUBLE_ESCAPE_MS - 100);
    escape();

    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith(DEFAULT_EXIT_URL);
  });

  it('does not leave on one Escape, which closes menus and dialogs and has other jobs on a page', () => {
    render(withQueries(<QuickExitButton variant="floating" />));

    escape();

    expect(leave).not.toHaveBeenCalled();
  });

  it('does not take two Escapes far apart for one gesture, and starts counting again from the later one', () => {
    jest.useFakeTimers();
    render(withQueries(<QuickExitButton variant="floating" />));

    escape();
    jest.advanceTimersByTime(DOUBLE_ESCAPE_MS + 500);
    escape();
    expect(leave).not.toHaveBeenCalled();

    // The later one is the first of a new pair.
    jest.advanceTimersByTime(200);
    escape();
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('does not take a held key for two presses', () => {
    render(withQueries(<QuickExitButton variant="floating" />));

    escape();
    escape({ repeat: true });
    escape({ repeat: true });

    expect(leave).not.toHaveBeenCalled();
  });

  it('does not leave when the page does not carry the button', () => {
    render(withQueries(<p>An ordinary page</p>));

    escape();
    escape();

    expect(leave).not.toHaveBeenCalled();
  });

  it('leaves on one Escape for a member who asked for that, for the page she chose', async () => {
    signedIn = true;
    getSettings.mockResolvedValue({ data: { safeExitEnabled: true, safeExitUrl: 'https://www.bom.gov.au' } });
    render(withQueries(<QuickExitButton variant="floating" />));
    // The title changes once her settings have arrived and the shortcut is on.
    await screen.findByTitle(/The Escape key does the same/);

    escape();

    expect(leave).toHaveBeenCalledWith('https://www.bom.gov.au');
  });

  it('says on the button what the Escape key will do', () => {
    render(withQueries(<QuickExitButton variant="floating" />));

    expect(screen.getByRole('button', { name: /quick exit/i })).toHaveAttribute('title', expect.stringMatching(/twice quickly/));
  });
});
