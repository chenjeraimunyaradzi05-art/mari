import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';

// Card entry happens inside Stripe's own iframe, which cannot mount here, so
// the element is stood in for and the confirmation is driven by hand.
const mockStripe: {
  configured: boolean;
  loaded: boolean;
  confirmPayment: jest.Mock;
  elementsOptions: { clientSecret?: string } | undefined;
} = {
  configured: true,
  loaded: true,
  confirmPayment: jest.fn(),
  elementsOptions: undefined,
};

jest.mock('@/lib/stripe', () => ({
  get stripeConfigured() {
    return mockStripe.configured;
  },
  getStripe: () => (mockStripe.configured ? Promise.resolve({}) : null),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children, options }: { children: React.ReactNode; options?: { clientSecret?: string } }) => {
    mockStripe.elementsOptions = options;
    return <>{children}</>;
  },
  PaymentElement: () => <div data-testid="card-details" />,
  useStripe: () => (mockStripe.loaded ? { confirmPayment: mockStripe.confirmPayment } : null),
  useElements: () => (mockStripe.loaded ? {} : null),
}));

const authoriseButton = () => screen.getByRole('button', { name: /Authoris/ });

function renderForm(props: Partial<React.ComponentProps<typeof PaymentIntentForm>> = {}) {
  const onAuthorised = jest.fn();
  render(<PaymentIntentForm clientSecret="pi_3ABC_secret_XYZ" amountLabel="$120.00" onAuthorised={onAuthorised} {...props} />);
  return { onAuthorised: props.onAuthorised ?? onAuthorised };
}

describe('PaymentIntentForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStripe.configured = true;
    mockStripe.loaded = true;
    mockStripe.elementsOptions = undefined;
  });

  it('hands Stripe the client secret it was given, and asks for the card', () => {
    renderForm();

    expect(mockStripe.elementsOptions?.clientSecret).toBe('pi_3ABC_secret_XYZ');
    expect(screen.getByTestId('card-details')).toBeInTheDocument();
    expect(authoriseButton()).toHaveTextContent('Authorise $120.00');
  });

  it('waits rather than authorising while Stripe is still loading', () => {
    mockStripe.loaded = false;
    renderForm();

    expect(authoriseButton()).toBeDisabled();
    fireEvent.click(authoriseButton());
    expect(mockStripe.confirmPayment).not.toHaveBeenCalled();
  });

  it('holds the amount on the card without leaving the page', async () => {
    mockStripe.confirmPayment.mockResolvedValue({});
    const { onAuthorised } = renderForm();

    fireEvent.click(authoriseButton());

    await waitFor(() => expect(onAuthorised).toHaveBeenCalledTimes(1));
    expect(mockStripe.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({ redirect: 'if_required' }));
  });

  it('says why the card was refused, and lets her try again', async () => {
    mockStripe.confirmPayment.mockResolvedValue({ error: { message: 'Your card was declined.' } });
    const { onAuthorised } = renderForm();

    fireEvent.click(authoriseButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Your card was declined.');
    expect(onAuthorised).not.toHaveBeenCalled();
    expect(authoriseButton()).toBeEnabled();
  });

  it('still says something when the refusal comes back without a reason', async () => {
    mockStripe.confirmPayment.mockResolvedValue({ error: {} });
    const { onAuthorised } = renderForm();

    fireEvent.click(authoriseButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be authorised/i);
    expect(onAuthorised).not.toHaveBeenCalled();
  });

  it('authorises once, however many times the button is pressed', async () => {
    let settle: (result: Record<string, unknown>) => void = () => undefined;
    mockStripe.confirmPayment.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      })
    );
    const { onAuthorised } = renderForm();

    fireEvent.click(authoriseButton());
    expect(authoriseButton()).toBeDisabled();
    fireEvent.click(authoriseButton());

    await act(async () => {
      settle({});
    });

    expect(mockStripe.confirmPayment).toHaveBeenCalledTimes(1);
    expect(onAuthorised).toHaveBeenCalledTimes(1);
  });

  it('steps aside when card payments are not switched on, rather than blocking the booking', () => {
    mockStripe.configured = false;
    const onSkip = jest.fn();
    renderForm({ onSkip });

    expect(screen.getByText(/not switched on for this site/i)).toBeInTheDocument();
    expect(screen.queryByTestId('card-details')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('offers the caller its own wording for leaving the payment until later', () => {
    const onSkip = jest.fn();
    renderForm({ onSkip, skipLabel: 'Not now' });

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
