import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * Placing an order holds the price on the buyer's card, and a card hold lasts
 * about a week while a package can take longer. The last thing she reads before
 * she pays has to say so, plainly, so that being asked to renew it later is not
 * a surprise and does not read as being charged twice.
 */

jest.mock('@/lib/stripe', () => ({ stripeConfigured: true, getStripe: () => Promise.resolve({}) }));
jest.mock('@/components/payments/PaymentIntentForm', () => ({
  PaymentIntentForm: () => <div>card form</div>,
}));

import { OrderModal } from './OrderModal';

const service = {
  id: 's1',
  title: 'Brand refresh',
  description: 'A logo and a style sheet.',
  category: 'CREATIVE',
  hourlyRate: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  provider: { id: 'p1', displayName: 'Mei Chen' },
  packages: [{ name: 'Standard', description: 'Logo and style sheet', price: 250, deliveryDays: 21, revisions: 2, features: ['Two concepts'] }],
};

function openConfirmStep() {
  render(<OrderModal isOpen onClose={jest.fn()} service={service} onOrder={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Continue with Standard/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('The order confirmation', () => {
  it('says the card is held and not charged until she approves the work', () => {
    openConfirmStep();

    expect(screen.getByText(/held, not charged, until you approve the delivered work/)).toBeInTheDocument();
  });

  it('says a hold lasts about a week, that a longer job means a renewal request, and that renewing never charges her', () => {
    openConfirmStep();

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/A card hold lasts about a week/);
    expect(text).toMatch(/we will ask you to renew it before it runs out/);
    expect(text).toMatch(/Renewing never charges you/);
  });

  it('puts the amount on the button that places the order', () => {
    openConfirmStep();

    expect(screen.getByRole('button', { name: /Hold \$250.* and order/ })).toBeInTheDocument();
  });
});
