import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * A sign-up whose account was saved but whose confirmation email could not be
 * sent (the server's VERIFICATION_EMAIL_FAILED). The panel must not claim an
 * email is on its way, and the resend button is the way forward.
 */

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));

import { CheckYourEmail } from './CheckYourEmail';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CheckYourEmail when the email could not be sent', () => {
  it('says the email did not go and that her details are saved, instead of saying a link is on its way', () => {
    render(<CheckYourEmail email="her@example.com" onStartAgain={jest.fn()} sendFailed />);

    expect(screen.getByRole('heading', { name: 'We could not send your email' })).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toContain('her@example.com');
    expect(text).toMatch(/details are saved/i);
    expect(text).not.toMatch(/we have sent a link/i);
  });

  it('still offers the resend button, and it asks for a new link for the address she gave', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    render(<CheckYourEmail email="her@example.com" onStartAgain={jest.fn()} sendFailed />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send it again' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/resend-verification', { email: 'her@example.com' });
  });

  it('keeps the way back to the form for an address typed wrongly', () => {
    const onStartAgain = jest.fn();
    render(<CheckYourEmail email="her@example.com" onStartAgain={onStartAgain} sendFailed />);

    fireEvent.click(screen.getByRole('button', { name: /start again/i }));

    expect(onStartAgain).toHaveBeenCalledTimes(1);
  });
});
