import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

import { QuickExitButton, resetFloatingExitClaims } from './QuickExit';

function withQueries(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  signedIn = false;
  getSettings.mockReset();
  act(() => resetFloatingExitClaims());
});

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
