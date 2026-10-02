import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The billing page used to render a hardcoded Free / Pro A$29 / Enterprise
 * A$99 list. Pro checked out at its real Stripe price under a card promising
 * A$29, and Enterprise sent a tier checkout does not sell, so it failed with a
 * 400 every time. A paying member was also shown a A$29 fallback price, "No
 * saved payment method" and "No billing history available", none of which the
 * page had any way of knowing.
 *
 * It also said nothing about the trial. A first subscription starts a card
 * trial that is charged on the day it ends, and the page where she upgrades, and
 * the page she comes back to, never said when, or how much.
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));

const checkout = { mutate: jest.fn(), isPending: false, isSuccess: false };
const cancel = { mutate: jest.fn(), isPending: false };
const manage = { mutate: jest.fn(), isPending: false };
let authUser: Record<string, unknown> = { region: 'ANZ', subscriptionTier: 'FREE' };
let subscriptionRow: Record<string, unknown> | undefined;
// When set, the checkout hook is a real react-query mutation, which hands back a
// new result object on every state change as the real hook does. The stable stub
// above cannot show an effect that re-runs on each change.
let realCheckoutCall: jest.Mock | null = null;
jest.mock('@/lib/hooks', () => ({
  useAuth: () => ({ user: authUser }),
  useSubscription: () => ({ data: subscriptionRow }),
  useCancelSubscription: () => cancel,
  useManageBilling: () => manage,
  useCreateCheckout: () => {
    if (!realCheckoutCall) return checkout;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useMutation } = require('@tanstack/react-query');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMutation({ mutationFn: realCheckoutCall });
  },
  usePaymentMethods: () => ({ data: [], isLoading: false, isError: false }),
}));

import BillingSettingsPage from './page';
import { api } from '@/lib/api';

const http = api as unknown as { get: jest.Mock };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BillingSettingsPage />
    </QueryClientProvider>
  );
}

const plansResponse = (extra: Record<string, unknown> = {}) => ({
  data: {
    data: {
      currency: 'AUD',
      trialDays: 14,
      plans: [
        { tier: 'PREMIUM_CAREER', available: true, currency: 'AUD', unitAmount: 999, amount: 9.99, interval: 'month', intervalCount: 1 },
      ],
      ...extra,
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  searchParams = new URLSearchParams();
  authUser = { region: 'ANZ', subscriptionTier: 'FREE' };
  subscriptionRow = undefined;
  realCheckoutCall = null;
  http.get.mockResolvedValue(plansResponse());
});

/**
 * "Choose Pro" on the pricing page sends the member here with ?upgrade=pro, and
 * the page starts the checkout for her. Checkout now refuses a member who already
 * has a membership, and a refused start used to be started again the instant it
 * failed, for ever.
 */
describe('a checkout started from ?upgrade=', () => {
  const refused = () => Object.assign(new Error('You already have an ATHENA membership'), { response: { status: 409 } });

  it('is tried once when the server refuses it, not again each time it fails', async () => {
    searchParams = new URLSearchParams('upgrade=pro');
    realCheckoutCall = jest.fn().mockRejectedValue(refused());

    renderPage();
    await screen.findAllByText(/9\.99/);
    // Long enough for a loop to show: every failure re-renders the page.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(realCheckoutCall).toHaveBeenCalledTimes(1);
    expect(realCheckoutCall.mock.calls[0][0]).toBe('PREMIUM_CAREER');
  });

  it('is not started at all for a member who already holds a paid plan', async () => {
    searchParams = new URLSearchParams('upgrade=pro');
    authUser = { region: 'ANZ', subscriptionTier: 'PREMIUM_CAREER' };
    subscriptionRow = { tier: 'PREMIUM_CAREER', status: 'ACTIVE', amount: '9.99', currency: 'AUD', interval: 'month' };
    realCheckoutCall = jest.fn().mockResolvedValue({ data: { data: {} } });

    renderPage();
    await screen.findByText(/9\.99\/month/);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(realCheckoutCall).not.toHaveBeenCalled();
  });

  it('is started for a free member, with the tier checkout sells', async () => {
    searchParams = new URLSearchParams('upgrade=pro');

    renderPage();
    await screen.findAllByText(/9\.99/);

    expect(checkout.mutate).toHaveBeenCalledTimes(1);
    expect(checkout.mutate).toHaveBeenCalledWith('PREMIUM_CAREER');
  });
});

it('prices Pro from Stripe and upgrades to the tier checkout sells', async () => {
  renderPage();

  // The price on the card, and the same figure in the sentence under the button.
  expect((await screen.findAllByText(/9\.99/)).length).toBeGreaterThanOrEqual(1);
  fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }));
  expect(checkout.mutate).toHaveBeenCalledWith('PREMIUM_CAREER');

  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(/29/);
  expect(text).not.toMatch(/\$99/);
});

it('offers no Enterprise checkout, only a conversation', async () => {
  renderPage();
  await screen.findAllByText(/9\.99/);

  // One Upgrade button, for Pro. Enterprise is a link to talk to someone.
  expect(screen.getAllByRole('button', { name: 'Upgrade' })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Talk to us' })).toHaveAttribute('href', '/contact-sales');
});

it('shows a paying member what Stripe reported, not an invented A$29', async () => {
  authUser = { region: 'ANZ', subscriptionTier: 'PREMIUM_CAREER' };
  subscriptionRow = { tier: 'PREMIUM_CAREER', status: 'ACTIVE', amount: '9.99', currency: 'AUD', interval: 'month', currentPeriodEnd: null };

  renderPage();

  expect(await screen.findByText(/9\.99\/month/)).toBeInTheDocument();
  expect(screen.queryByText('No saved payment method')).not.toBeInTheDocument();
  expect(screen.queryByText('No billing history available')).not.toBeInTheDocument();
  expect(document.body.textContent ?? '').not.toMatch(/29/);
});

it('says nothing was charged when she comes back from a cancelled checkout', async () => {
  searchParams = new URLSearchParams('checkout=cancelled');

  renderPage();

  expect(await screen.findByText('Checkout was cancelled. Nothing was charged.')).toBeInTheDocument();
});

describe('before she upgrades', () => {
  it('says, under the Upgrade button, that a card is needed and what it is charged when the trial ends', async () => {
    renderPage();
    await screen.findAllByText(/9\.99/);

    const note = screen.getByText(/A card is needed to start it/);
    expect(note.textContent).toMatch(/14-day free trial/);
    expect(note.textContent).toMatch(/is\s+charged .*9\.99 a month on the day the trial ends unless you cancel first/);
    // A returning subscriber gets no trial, and is told the card is charged at checkout.
    expect(note.textContent).toMatch(/If you have subscribed before/);
  });

  it('names no price in that sentence when it could not read one', async () => {
    http.get.mockResolvedValue(plansResponse({ plans: [{ tier: 'PREMIUM_CAREER', available: false }] }));

    renderPage();
    await screen.findByText(/price is not available right now/i);

    const note = screen.getByText(/A card is needed to start it/);
    expect(note.textContent).toMatch(/charged the Pro price on the day/);
    expect(note.textContent).not.toMatch(/\d\.\d\d/);
  });

  it('prints the GST sentence the server sends, and nothing when it sends none', async () => {
    http.get.mockResolvedValue(
      plansResponse({
        gst: { registered: true, statement: 'Prices are in Australian dollars (AUD) and include GST.' },
      })
    );
    const first = renderPage();
    expect(await screen.findByText(/and include GST/)).toBeInTheDocument();
    first.unmount();

    http.get.mockResolvedValue(plansResponse());
    renderPage();
    await screen.findAllByText(/9\.99/);
    expect(document.body.textContent ?? '').not.toMatch(/GST/);
  });
});

/**
 * A member on a trial is told the day it ends, what is charged on it, and how to
 * stop it. The first she would otherwise hear of the charge is the charge.
 */
describe('while she is on a free trial', () => {
  const trialing = (extra: Record<string, unknown> = {}) => ({
    tier: 'PREMIUM_CAREER',
    status: 'TRIALING',
    amount: '9.99',
    currency: 'AUD',
    interval: 'month',
    currentPeriodEnd: '2099-01-20T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    ...extra,
  });

  beforeEach(() => {
    authUser = { region: 'ANZ', subscriptionTier: 'PREMIUM_CAREER' };
  });

  it('says when the trial ends and that the card is charged that day unless she cancels', async () => {
    subscriptionRow = trialing();

    renderPage();

    const banner = await screen.findByText(/Your free trial ends on/);
    expect(banner.textContent).toMatch(/2099/);
    expect(banner.textContent).toMatch(/On that day your card is charged\s+[A-Z]*\$9\.99\/month unless you cancel before then/);
    expect(banner.textContent).toMatch(/email you a few days ahead/);
  });

  it('offers to cancel from the notice, and the confirmation says she will not be charged', async () => {
    subscriptionRow = trialing();

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel before I am charged' }));

    const confirmation = screen.getByText(/Cancel now and you will not be charged/);
    expect(confirmation.textContent).toMatch(/Your trial carries on until .*2099/);
    expect(confirmation.textContent).toMatch(/Free plan/);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Subscription' }));
    expect(cancel.mutate).toHaveBeenCalledTimes(1);
  });

  it('says she will not be charged once she has cancelled, and offers no second cancel', async () => {
    subscriptionRow = trialing({ cancelAtPeriodEnd: true });

    renderPage();

    const banner = await screen.findByText(/you will not be charged/);
    expect(banner.textContent).toMatch(/ends on .*2099/);
    expect(banner.textContent).toMatch(/keep the Free plan/);
    expect(screen.queryByRole('button', { name: 'Cancel before I am charged' })).not.toBeInTheDocument();
  });

  it('shows no trial notice to a member whose membership is active', async () => {
    subscriptionRow = trialing({ status: 'ACTIVE' });

    renderPage();
    await screen.findByText(/9\.99\/month/);

    expect(document.body.textContent ?? '').not.toMatch(/free trial/i);
    expect(screen.queryByRole('button', { name: 'Cancel before I am charged' })).not.toBeInTheDocument();
  });

  it('does not invent a date or a price it was not given', async () => {
    subscriptionRow = trialing({ currentPeriodEnd: null, amount: null, currency: null });

    renderPage();

    const banner = await screen.findByText(/Your free trial is running/);
    expect(banner.textContent).toMatch(/charged\s+the price shown in the billing portal unless you cancel/);
    expect(banner.textContent).not.toMatch(/\d\.\d\d/);
  });
});

/**
 * Which plan she is on comes from the subscription row. /auth/me has never set
 * `user.subscriptionTier` (see the note on the field in lib/types.ts), so a page
 * that read it called every member a free member: a paying member was offered
 * Upgrade and sent to a checkout the server refuses, and the trial notice above
 * could not show to anyone, because it was gated on the same field.
 */
describe('which plan she is on', () => {
  const paidRow = (extra: Record<string, unknown> = {}) => ({
    tier: 'PREMIUM_CAREER',
    status: 'TRIALING',
    amount: '9.99',
    currency: 'AUD',
    interval: 'month',
    currentPeriodEnd: '2099-01-20T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    ...extra,
  });

  beforeEach(() => {
    // The user object as the server really sends it: no tier on it at all.
    authUser = { region: 'ANZ' };
  });

  it('is read from the subscription row, so a member on a trial sees the notice although the user object names no tier', async () => {
    subscriptionRow = paidRow();

    renderPage();

    expect(await screen.findByText(/Your free trial ends on/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel before I am charged' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Billing' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upgrade' })).not.toBeInTheDocument();
  });

  it('shows a paying member her plan, and does not start a second checkout from ?upgrade=', async () => {
    searchParams = new URLSearchParams('upgrade=pro');
    subscriptionRow = paidRow({ status: 'ACTIVE' });
    realCheckoutCall = jest.fn().mockResolvedValue({ data: { data: {} } });

    renderPage();
    await screen.findByText(/9\.99\/month/);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getAllByText('ATHENA Pro').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'Upgrade' })).not.toBeInTheDocument();
    expect(realCheckoutCall).not.toHaveBeenCalled();
  });

  it('treats a membership that has ended as the free plan, whatever tier the row still names', async () => {
    subscriptionRow = paidRow({ status: 'CANCELED' });

    renderPage();
    await screen.findAllByText(/9\.99/);

    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage Billing' })).not.toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/free trial ends/i);
  });
});

/**
 * The plan cards listed "5 job applications/month" on Free, "Unlimited job
 * applications" on Pro, "Priority support" and "Exclusive events access". No
 * route caps applications, and there is no priority support and no events
 * access by tier. What Pro really unlocks is the six AI tools and a bigger AI
 * chat allowance, so that is all the cards say.
 */
describe('what the plan cards promise', () => {
  it.each([
    ['an application cap', /\d+ job applications/i],
    ['unlimited applications', /unlimited (job )?applications/i],
    ['priority support', /priority support/i],
    ['events access', /events access/i],
  ])('does not promise %s', async (_what, pattern) => {
    renderPage();
    await screen.findAllByText(/9\.99/);

    expect(document.body.textContent ?? '').not.toMatch(pattern);
  });

  it('lists the AI tools on Pro, and what Free really has', async () => {
    renderPage();
    await screen.findAllByText(/9\.99/);

    const text = document.body.textContent ?? '';
    for (const line of [
      'Job search and applications',
      'ATHENA AI chat, with a daily allowance',
      'AI Resume Optimizer',
      'Interview Coach',
      'Opportunity Radar AI',
      'Career Path Planner',
      'AI Content Generator',
      'Business Idea Validator',
      'A larger daily allowance for the ATHENA AI chat',
    ]) {
      expect(text).toContain(line);
    }
  });
});

/**
 * A renewal whose payment failed. Stripe tries the card again for a few days and
 * the server keeps her paid tools on for a grace meanwhile, then pauses them. The
 * page used to say nothing: it listed "Past due" as a status and went on saying she
 * had access to everything, so she found out by a tool being switched off.
 */
describe('when a payment has failed', () => {
  const pastDue = (extra: Record<string, unknown> = {}) => ({
    tier: 'PREMIUM_CAREER',
    status: 'PAST_DUE',
    amount: '9.99',
    currency: 'AUD',
    interval: 'month',
    currentPeriodEnd: '2099-02-20T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    entitled: true,
    graceEndsAt: '2099-01-27T12:00:00.000Z',
    ...extra,
  });

  beforeEach(() => {
    authUser = { region: 'ANZ', subscriptionTier: 'PREMIUM_CAREER' };
  });

  it('says she keeps her plan until the day the grace ends, and offers the way to fix the card', async () => {
    subscriptionRow = pastDue();

    renderPage();

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toMatch(/last payment did not go through/);
    expect(notice.textContent).toMatch(/Stripe is trying your card again/);
    expect(notice.textContent).toMatch(/you keep your plan until .*2099/);
    expect(document.body.textContent ?? '').toMatch(/You have access to all premium features/);

    fireEvent.click(screen.getByRole('button', { name: 'Update my card' }));
    expect(manage.mutate).toHaveBeenCalledTimes(1);
  });

  it('says the paid tools are paused, and that nothing is lost, once the grace is over', async () => {
    subscriptionRow = pastDue({ entitled: false, graceEndsAt: '2020-01-01T00:00:00.000Z' });

    renderPage();

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toMatch(/paid tools are paused until it does/);
    expect(notice.textContent).toMatch(/Nothing you have made is lost/);
    expect(notice.textContent).not.toMatch(/you keep your plan/);
    // The header no longer claims access she does not have.
    expect(document.body.textContent ?? '').not.toMatch(/You have access to all premium features/);
    expect(document.body.textContent ?? '').toMatch(/Your paid tools are paused until your payment goes through/);
  });

  it('does not say the tools are paused when an older server has not said so, and gives no date it was not given', async () => {
    subscriptionRow = pastDue({ entitled: undefined, graceEndsAt: null });

    renderPage();

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toMatch(/you keep your plan while it does/);
    expect(notice.textContent).not.toMatch(/paused/);
  });

  it('shows no failed-payment notice to a member who is paid up', async () => {
    subscriptionRow = pastDue({ status: 'ACTIVE', entitled: true, graceEndsAt: null });

    renderPage();
    await screen.findByText(/9\.99\/month/);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update my card' })).not.toBeInTheDocument();
  });
});

/**
 * While an admin has paused new payments the server refuses every upgrade with a
 * 503. The plans endpoint says so, and the Upgrade button is held with the reason
 * beside it.
 */
describe('while payments are paused', () => {
  it('holds the Upgrade button and says why, in the words the server sends', async () => {
    http.get.mockResolvedValue(plansResponse({ paused: true, pauseMessage: 'Payments are paused while we check them. Nothing has been charged.' }));

    renderPage();

    const note = await screen.findByText('Payments are paused while we check them. Nothing has been charged.');
    expect(note).toHaveAttribute('role', 'status');
    const upgrade = screen.getByRole('button', { name: 'Upgrade' });
    expect(upgrade).toBeDisabled();
    expect(upgrade).toHaveAttribute('aria-describedby', note.id);

    fireEvent.click(upgrade);
    expect(checkout.mutate).not.toHaveBeenCalled();
  });

  it('says memberships are paused when the server sends no words of its own', async () => {
    http.get.mockResolvedValue(plansResponse({ paused: true, pauseMessage: null }));

    renderPage();

    expect(await screen.findByText('Memberships are paused while we finish checking payments.')).toBeInTheDocument();
  });

  it('leaves Upgrade live, with no pause note, when payments are open', async () => {
    http.get.mockResolvedValue(plansResponse({ paused: false, pauseMessage: null }));

    renderPage();
    await screen.findAllByText(/9\.99/);

    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeEnabled();
    expect(screen.queryByText(/paused/i)).not.toBeInTheDocument();
  });

  it('does not guess at a pause an older server never mentioned', async () => {
    http.get.mockResolvedValue(plansResponse());

    renderPage();
    await screen.findAllByText(/9\.99/);

    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeEnabled();
  });

  it('prints the chat allowance from the server\'s table on both plans', async () => {
    http.get.mockResolvedValue(
      plansResponse({
        entitlements: {
          free: { aiTools: false, aiChat: { messages: 20, windowSeconds: 86_400 } },
          paid: { aiTools: true, aiChat: { messages: 200, windowSeconds: 86_400 } },
        },
      })
    );

    renderPage();
    await screen.findAllByText(/9\.99/);

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/ATHENA AI chat, 20 messages a day/);
    expect(text).toMatch(/A larger allowance for the ATHENA AI chat: 200 messages a day/);
  });
});
