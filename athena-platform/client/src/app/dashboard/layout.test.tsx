import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * The dashboard shell is every page a signed-in member uses, so what it carries
 * is what she has everywhere: a way off the page for someone who has to leave
 * in a hurry, and her safety and privacy settings one tap away, on a phone as on
 * a desktop. Quick exit was on the safety, housing and wellness pages and
 * nowhere else; the messages, the feed and the settings had none, and Safety and
 * Privacy were two taps down behind Settings.
 */

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({
    user: { id: 'u1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', subscriptionTier: 'PRO' },
    logout: jest.fn(),
  }),
  useNotifications: () => ({ data: { unreadCount: 0 } }),
  useUnreadMessageCount: () => ({ data: 0 }),
  // Read by the quick exit, which asks for her chosen exit address only when signed in.
  useAuthStore: () => ({ isAuthenticated: false, isLoading: false }),
}));

jest.mock('@/lib/store', () => ({
  useUIStore: () => ({ isSidebarOpen: true, toggleSidebar: jest.fn(), theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

jest.mock('@/lib/api', () => ({ dvSafeApi: { getSettings: jest.fn() } }));

// The wellness menu has its own tests; here it is only a header that has one.
jest.mock('@/components/wellness/WellnessMenu', () => ({
  useWellnessMenu: () => ({ rootRef: { current: null }, hoverProps: {}, open: false }),
  WellnessTrigger: () => null,
  WellnessPanel: () => null,
}));

import DashboardLayout from './layout';
import { QuickExitButton, resetFloatingExitClaims } from './safety/QuickExit';
import { EmergencyHelp } from '@/components/safety/EmergencyHelp';

function inQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  window.localStorage.clear();
  act(() => resetFloatingExitClaims());
});

describe('the dashboard shell', () => {
  it('carries a quick exit for every page beneath it', () => {
    render(inQueryClient(<DashboardLayout><p>Any page at all</p></DashboardLayout>));

    expect(screen.getByText('Any page at all')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /quick exit/i })).toHaveLength(1);
  });

  it('shows one floating exit, not two stacked, when a page beneath it mounts its own', () => {
    render(
      inQueryClient(
        <DashboardLayout>
          <QuickExitButton variant="floating" />
        </DashboardLayout>
      )
    );

    expect(screen.getAllByRole('button', { name: /quick exit/i })).toHaveLength(1);
  });

  it('carries Emergency help for every page beneath it, with the numbers to ring one tap in', () => {
    render(inQueryClient(<DashboardLayout><p>Any page at all</p></DashboardLayout>));

    // One button, beside the exit, whichever page is open and whatever it is doing.
    fireEvent.click(screen.getByRole('button', { name: /emergency help/i }));

    const dialog = screen.getByRole('dialog', { name: /emergency help/i });
    expect(within(dialog).getByRole('link', { name: /Emergency 000/ })).toHaveAttribute('href', 'tel:000');
    expect(within(dialog).getByRole('link', { name: /1800RESPECT 1800 737 732/ })).toHaveAttribute('href', 'tel:1800737732');
  });

  it('shows one Emergency help button, not two, when a page beneath it mounts its own', () => {
    render(
      inQueryClient(
        <DashboardLayout>
          <EmergencyHelp />
        </DashboardLayout>
      )
    );

    expect(screen.getAllByRole('button', { name: /emergency help/i })).toHaveLength(1);
  });

  it('puts Safety and Privacy in the account navigation, which is also the phone menu', () => {
    render(inQueryClient(<DashboardLayout><p>Page</p></DashboardLayout>));

    const nav = within(screen.getByRole('navigation'));

    expect(nav.getByRole('link', { name: 'Safety' })).toHaveAttribute('href', '/dashboard/safety');
    expect(nav.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/dashboard/settings/privacy');
    // And Settings is still where it was.
    expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/dashboard/settings');
  });
});
