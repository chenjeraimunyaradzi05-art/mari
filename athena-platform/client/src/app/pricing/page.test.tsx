import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The public pricing page used to print its own prices: Pro at A$29 a month,
 * or A$290 "billed annually" with the toggle defaulting to yearly and a "Save
 * 16%" badge, and Enterprise at A$99. Checkout charged none of those — Pro
 * starts a monthly PREMIUM_CAREER checkout at its real Stripe price, and no
 * yearly price exists. The page now shows the price the server reads from
 * Stripe, or says it does not know it.
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: null }) }));

import PricingPage from './page';
import { api } from '@/lib/api';

const http = api as unknown as { get: jest.Mock };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PricingPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  http.get.mockReset();
});

it('shows Pro at the price Stripe will charge, monthly, and nothing yearly', async () => {
  http.get.mockResolvedValue({
    data: {
      data: {
        currency: 'AUD',
        trialDays: 14,
        plans: [
          {
            tier: 'PREMIUM_CAREER',
            available: true,
            currency: 'AUD',
            unitAmount: 999,
            amount: 9.99,
            interval: 'month',
            intervalCount: 1,
          },
        ],
      },
    },
  });

  renderPage();

  // The price on the card, and the same figure in the sentence at the button
  // that says what the card is charged when the trial ends.
  expect((await screen.findAllByText(/9\.99/)).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('/month')).toBeInTheDocument();
  expect(http.get).toHaveBeenCalledWith('/subscriptions/plans');

  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(/29/);
  expect(text).not.toMatch(/billed annually/i);
  expect(text).not.toMatch(/Save \d+%/);
  expect(text).not.toMatch(/\$99/);
});

it('says it could not load the price rather than printing one', async () => {
  http.get.mockRejectedValue(new Error('network down'));

  renderPage();

  expect(await screen.findByText(/could not load the price just now/i)).toBeInTheDocument();
  expect(document.body.textContent ?? '').not.toMatch(/\$\d/);
});

it('shows no price for a Pro tier that is not set up on this deployment', async () => {
  http.get.mockResolvedValue({
    data: { data: { currency: 'AUD', trialDays: 14, plans: [{ tier: 'PREMIUM_CAREER', available: false }] } },
  });

  renderPage();

  expect(await screen.findByText(/price is not available right now/i)).toBeInTheDocument();
});

/**
 * The trial is a card trial. A card is entered to start it and is charged on the
 * day it ends unless she cancels first, which is what Stripe Checkout does, what
 * the Terms (6.4) say and what the first FAQ answer says. The second answer used
 * to promise she would be moved to the Free plan "unless you choose to
 * subscribe": a statement about money, on the page that sells the product, that
 * was false.
 */
describe('what the page says about the end of the trial', () => {
  const plansWithPrice = {
    data: {
      data: {
        currency: 'AUD',
        trialDays: 14,
        refundDays: 30,
        plans: [
          { tier: 'PREMIUM_CAREER', available: true, currency: 'AUD', unitAmount: 999, amount: 9.99, interval: 'month', intervalCount: 1 },
        ],
      },
    },
  };

  it('no longer says she is moved to the Free plan unless she subscribes', async () => {
    http.get.mockResolvedValue(plansWithPrice);
    renderPage();
    await screen.findAllByText(/9\.99/);

    fireEvent.click(screen.getByRole('button', { name: /What happens when my trial ends/i }));

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/moved to the Free plan/i);
    expect(text).not.toMatch(/unless you choose to subscribe/i);
  });

  it('says the card is charged on the day the trial ends, and how to stop it', async () => {
    http.get.mockResolvedValue(plansWithPrice);
    renderPage();
    await screen.findAllByText(/9\.99/);

    fireEvent.click(screen.getByRole('button', { name: /What happens when my trial ends/i }));

    const answer = screen.getByText(/The card you entered to start the trial is charged/i);
    expect(answer.textContent).toMatch(/on the day the trial ends/i);
    expect(answer.textContent).toMatch(/unless you cancel first/i);
    expect(answer.textContent).toMatch(/Settings, then Billing/i);
    expect(answer.textContent).toMatch(/pay nothing/i);
    expect(answer.textContent).toMatch(/email you a few days before/i);
  });

  it('says at the button that a card is needed and what it is charged', async () => {
    http.get.mockResolvedValue(plansWithPrice);
    renderPage();
    await screen.findAllByText(/9\.99/);

    const note = screen.getByText(/A card is needed to start it, and it is charged/i);
    expect(note.textContent).toMatch(/14-day free trial/);
    // The real price and how often, the way Stripe will charge it.
    expect(note.textContent).toMatch(/9\.99 a month/);
    expect(note.textContent).toMatch(/on the\s+day the trial ends unless you cancel first/);
  });

  it('does not name a price in that sentence when it could not read one', async () => {
    http.get.mockResolvedValue({
      data: { data: { currency: 'AUD', trialDays: 14, plans: [{ tier: 'PREMIUM_CAREER', available: false }] } },
    });
    renderPage();
    await screen.findByText(/price is not available right now/i);

    const note = screen.getByText(/A card is needed to start it, and it is charged/i);
    expect(note.textContent).toMatch(/charged the Pro price on the/);
    expect(note.textContent).not.toMatch(/\d\.\d\d/);
  });

  it('prints the GST sentence the server sends, and none when it sends none', async () => {
    http.get.mockResolvedValue({
      data: {
        data: {
          ...plansWithPrice.data.data,
          gst: {
            registered: false,
            statement: 'Prices are in Australian dollars (AUD). ATHENA is not registered for GST, so none is added.',
          },
        },
      },
    });
    const first = renderPage();
    expect(await screen.findByText(/not registered for GST, so none is added/)).toBeInTheDocument();
    first.unmount();

    http.get.mockResolvedValue(plansWithPrice);
    renderPage();
    await screen.findAllByText(/9\.99/);
    expect(document.body.textContent ?? '').not.toMatch(/GST/);
  });

  it('keeps the refund promise the Terms make, at the same number of days', async () => {
    http.get.mockResolvedValue(plansWithPrice);
    renderPage();
    await screen.findAllByText(/9\.99/);

    expect(screen.getByText(/30-day money-back guarantee/)).toBeInTheDocument();
  });
});

/**
 * The cards promised benefits nothing delivers: an application cap on Free that
 * no route enforces, "Unlimited" applications, 20% off courses, a free mentor
 * session a month and ten interview-coach sessions a month on Pro, and SSO/SAML,
 * API access and a dedicated account manager on Enterprise. A member would pay
 * for those. The page now lists only what the server does.
 */
describe('what the plans promise', () => {
  const plans = {
    data: {
      data: {
        currency: 'AUD',
        trialDays: 14,
        plans: [{ tier: 'PREMIUM_CAREER', available: true, currency: 'AUD', unitAmount: 999, amount: 9.99, interval: 'month', intervalCount: 1 }],
      },
    },
  };

  async function pageText() {
    http.get.mockResolvedValue(plans);
    renderPage();
    await screen.findAllByText(/9\.99/);
    return document.body.textContent ?? '';
  }

  it.each([
    ['an application cap on Free', /\d+ job applications\/month/i],
    ['unlimited applications', /unlimited (job )?applications/i],
    ['a course discount', /\d+% off/i],
    ['a free mentor session', /free mentor session/i],
    ['an interview coach allowance', /\d+ sessions\/mo/i],
    ['priority job matches', /priority job matches/i],
    ['priority or premium support', /(priority|premium) support/i],
    ['a student or non-profit discount', /non-?profit/i],
    ['SSO or SAML', /SSO|SAML/],
    ['API access', /API access/i],
    ['a dedicated account manager', /account manager/i],
    ['custom job boards', /custom job boards/i],
    ['unlimited team members', /unlimited team/i],
  ])('does not promise %s', async (_what, pattern) => {
    expect(await pageText()).not.toMatch(pattern);
  });

  it('lists the six AI tools Pro really unlocks, and the bigger chat allowance', async () => {
    const text = await pageText();

    for (const tool of [
      'AI Resume Optimizer',
      'Interview Coach',
      'Opportunity Radar AI',
      'Career Path Planner',
      'AI Content Generator',
      'Business Idea Validator',
    ]) {
      // Once as included on Pro, and once as not included on Free.
      expect(text.split(tool).length - 1).toBe(2);
    }
    expect(text).toMatch(/A larger daily allowance for the ATHENA AI chat/);
  });

  it('says Free members can apply for jobs, with no count attached', async () => {
    const text = await pageText();

    expect(text).toMatch(/Job search and applications/);
  });

  it('gives Enterprise no feature checklist, only an invitation to talk', async () => {
    const text = await pageText();

    expect(screen.getByRole('button', { name: /Talk to us/ })).toBeInTheDocument();
    expect(text).toMatch(/we will say plainly what we can offer, and what it costs/);
    expect(text).not.toMatch(/Contact Sales/);
  });

  it('does not say how many women use ATHENA: there is no verified count (docs/security/trust-claims-register.md)', async () => {
    const text = await pageText();

    expect(text).not.toMatch(/thousands/i);
  });

  it('still keeps the trial and refund promises the Terms make', async () => {
    const text = await pageText();

    expect(text).toMatch(/30-day money-back guarantee/);
    expect(text).toMatch(/14-day free trial/);
  });
});

/**
 * While an admin has paused new payments the server refuses every upgrade with a
 * 503, and the plans endpoint says so. The Upgrade button is held and the page
 * says why in the admin's own words, instead of letting each press end in a toast.
 */
describe('while payments are paused', () => {
  const planWith = (extra: Record<string, unknown>) => ({
    data: {
      data: {
        currency: 'AUD',
        trialDays: 14,
        plans: [{ tier: 'PREMIUM_CAREER', available: true, currency: 'AUD', unitAmount: 999, amount: 9.99, interval: 'month', intervalCount: 1 }],
        ...extra,
      },
    },
  });

  it('holds the Upgrade buttons and says so, in the words the server sends', async () => {
    http.get.mockResolvedValue(planWith({ paused: true, pauseMessage: 'Payments are paused while we check them. Nothing has been charged.' }));

    renderPage();

    const note = await screen.findByText('Payments are paused while we check them. Nothing has been charged.');
    expect(note).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: /Upgrade to Pro/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Start Free Trial/ })).toBeDisabled();
    // The button points at the note, so a screen reader hears why.
    expect(screen.getByRole('button', { name: /Upgrade to Pro/ })).toHaveAttribute('aria-describedby', note.id);
  });

  it('says memberships are paused when the server sends no words of its own', async () => {
    http.get.mockResolvedValue(planWith({ paused: true, pauseMessage: null }));

    renderPage();

    expect(await screen.findByText('Memberships are paused while we finish checking payments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upgrade to Pro/ })).toBeDisabled();
  });

  it('leaves the buttons live, and prints no pause note, when payments are open', async () => {
    http.get.mockResolvedValue(planWith({ paused: false, pauseMessage: null }));

    renderPage();
    await screen.findAllByText(/9\.99/);

    expect(screen.getByRole('button', { name: /Upgrade to Pro/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Start Free Trial/ })).toBeEnabled();
    expect(screen.queryByText(/paused/i)).not.toBeInTheDocument();
  });

  it('does not guess at a pause an older server never mentioned', async () => {
    http.get.mockResolvedValue(planWith({}));

    renderPage();
    await screen.findAllByText(/9\.99/);

    expect(screen.getByRole('button', { name: /Upgrade to Pro/ })).toBeEnabled();
  });
});

/**
 * The chat allowance on each card is the one the server enforces, not a phrase.
 * "A daily allowance" told a woman nothing; the number she gets is part of the
 * same table the AI router reads.
 */
describe('the chat allowance', () => {
  const planWith = (extra: Record<string, unknown>) => ({
    data: {
      data: {
        currency: 'AUD',
        trialDays: 14,
        plans: [{ tier: 'PREMIUM_CAREER', available: true, currency: 'AUD', unitAmount: 999, amount: 9.99, interval: 'month', intervalCount: 1 }],
        ...extra,
      },
    },
  });

  it('is printed from the server\'s table on both cards', async () => {
    http.get.mockResolvedValue(
      planWith({
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

  it('keeps the plain wording, and no number, when the server did not send one', async () => {
    http.get.mockResolvedValue(planWith({}));

    renderPage();
    await screen.findAllByText(/9\.99/);

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/ATHENA AI chat, with a daily allowance/);
    expect(text).toMatch(/A larger daily allowance for the ATHENA AI chat/);
    expect(text).not.toMatch(/\d+ messages/);
  });
});
