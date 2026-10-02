import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

/**
 * What a member who locked her own account is offered at sign-in: a new unlock
 * email. It sits inside the sign-in form so it is a button, goes to the route
 * that answers the same for every address, and says only what is true.
 */

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => mockPost(...args) } }));

import { RequestUnlockLink, isLockedAccountRefusal } from './RequestUnlockLink';
import { RESEND_COOLDOWN_SECONDS } from './CheckYourEmail';

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('isLockedAccountRefusal', () => {
  it('matches the server’s locked wording, and neither the suspended one nor the unconfirmed one', () => {
    expect(
      isLockedAccountRefusal(
        'This account is locked. You locked it to keep it safe, and the email we sent you has the link to unlock it. If you cannot find it, ask for a new one from the sign-in page.'
      )
    ).toBe(true);
    expect(isLockedAccountRefusal('This account has been suspended. If you believe this is a mistake, you can appeal from the sign-in page.')).toBe(false);
    expect(isLockedAccountRefusal('Please verify your email before signing in.')).toBe(false);
    // The brute-force lockout is a different thing, and has no unlock link.
    expect(isLockedAccountRefusal('Too many failed login attempts. Try again in 15 minutes.')).toBe(false);
    expect(isLockedAccountRefusal(undefined)).toBe(false);
  });
});

describe('RequestUnlockLink', () => {
  it('is a button, not a form, because it sits inside the sign-in form', () => {
    const { container } = render(<RequestUnlockLink email="her@example.com" />);
    expect(container.querySelector('form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Email me a new unlock link' })).toHaveAttribute('type', 'button');
  });

  it('asks for a new link for the address she typed and says only that one may be on its way', async () => {
    jest.useFakeTimers();
    mockPost.mockResolvedValue({ data: { success: true } });
    render(<RequestUnlockLink email="her@example.com" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Email me a new unlock link' }));
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/request-unlock', { email: 'her@example.com' });
    // Not "we have sent": the route does not say whether the account is locked.
    expect(screen.getByRole('status')).toHaveTextContent(/if that account is locked, a link to unlock it is on its way/i);
    expect(screen.getByRole('button', { name: `Send it again in ${RESEND_COOLDOWN_SECONDS}s` })).toBeDisabled();
  });

  it('says so when it could not ask', async () => {
    mockPost.mockRejectedValue(new Error('network'));
    render(<RequestUnlockLink email="her@example.com" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Email me a new unlock link' }));
    });

    expect(screen.getByRole('status')).toHaveTextContent(/could not send another just now/i);
    expect(screen.getByRole('button', { name: 'Email me a new unlock link' })).toBeEnabled();
  });

  it('asks for the address when none was typed, as after a refusal at Google or Facebook', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    render(<RequestUnlockLink />);

    const button = screen.getByRole('button', { name: 'Email me a new unlock link' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Email address of the locked account'), { target: { value: ' her@example.com ' } });
    expect(button).toBeEnabled();
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/request-unlock', { email: 'her@example.com' });
  });

  it('does not let Enter in that field submit the sign-in form it sits inside', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <RequestUnlockLink />
      </form>
    );

    const field = screen.getByLabelText('Email address of the locked account');
    fireEvent.change(field, { target: { value: 'her@example.com' } });
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/request-unlock', { email: 'her@example.com' });
    // keyDown's default action (implicit submit) was cancelled.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('tells her where the first email is, so she looks before asking again', () => {
    render(<RequestUnlockLink email="her@example.com" />);
    expect(screen.getByRole('group', { name: 'Unlock your account' })).toHaveTextContent(/junk folder/i);
  });
});
