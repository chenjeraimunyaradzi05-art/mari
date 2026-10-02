import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * What a member is told when she cancels. The toast said "Subscription
 * cancelled", which reads as if it had stopped; the membership runs to the end
 * of the period she has paid for, and the server sends the date.
 */

const mockCancel = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn() };

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => mockToast.success(...args),
    error: (...args: unknown[]) => mockToast.error(...args),
  },
}));
jest.mock('../socket', () => ({ socketClient: {} }));
jest.mock('../store', () => ({
  useAuthStore: jest.fn(),
  useUIStore: jest.fn(),
  useNotificationStore: jest.fn(),
  useMessageStore: jest.fn(),
}));
jest.mock('../api', () => ({
  api: {},
  subscriptionApi: { cancel: (...args: unknown[]) => mockCancel(...args) },
}));

import { cancellationMessage, useCancelSubscription } from '../hooks';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

describe('cancellationMessage', () => {
  it('names the day the membership ends and says she keeps it until then', () => {
    const message = cancellationMessage({ currentPeriodEnd: '2026-11-12T03:00:00.000Z', trialing: false });

    expect(message).toBe('Your membership will end on 12 November 2026. You keep it until then.');
    expect(message).not.toMatch(/^Subscription cancelled/);
  });

  it('says she will not be charged when it is a trial she is cancelling', () => {
    expect(cancellationMessage({ currentPeriodEnd: '2026-10-15T00:00:00.000Z', trialing: true })).toBe(
      'Cancelled. You keep Pro until 15 October 2026, and you will not be charged.'
    );
  });

  it('reads the date in Queensland time, so a late-evening UTC end is the next morning here', () => {
    // 22:00 UTC on the 14th is 08:00 on the 15th in Brisbane.
    expect(cancellationMessage({ currentPeriodEnd: '2026-10-14T22:00:00.000Z' })).toMatch(/15 October 2026/);
  });

  it.each([[undefined], [null], [{}], [{ currentPeriodEnd: null }], [{ currentPeriodEnd: 'not a date' }]])(
    'does not invent a date when there is none (%p)',
    (data) => {
      const message = cancellationMessage(data as never);

      expect(message).toBe('Cancelled. You keep your membership until the end of the period you have paid for.');
      expect(message).not.toMatch(/\d{4}/);
    }
  );
});

describe('useCancelSubscription', () => {
  it('toasts the end date the server sent, not "Subscription cancelled"', async () => {
    mockCancel.mockResolvedValue({
      data: { success: true, data: { cancelAtPeriodEnd: true, currentPeriodEnd: '2026-11-12T03:00:00.000Z', trialing: false } },
    });
    const { result } = renderHook(() => useCancelSubscription(), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith('Your membership will end on 12 November 2026. You keep it until then.')
    );
    expect(mockToast.success).not.toHaveBeenCalledWith('Subscription cancelled');
  });

  it('says what went wrong when the cancel fails', async () => {
    mockCancel.mockRejectedValue({ response: { data: { message: 'No active subscription found' } } });
    const { result } = renderHook(() => useCancelSubscription(), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('No active subscription found'));
  });
});
