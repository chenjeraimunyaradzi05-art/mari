import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SuspensionAppeal, isSuspendedRefusal } from './SuspensionAppeal';

/**
 * A suspended member's appeal from the sign-in page. The appeals API sits
 * behind a sign-in that refuses a suspended account, so this panel is the only
 * way she can send one; it has to carry her reason and credentials to the
 * dedicated route, and show the server's own answer either way.
 */

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

describe('SuspensionAppeal', () => {
  it('recognises the suspended-account refusal and nothing else', () => {
    expect(isSuspendedRefusal('This account has been suspended. Contact support if you believe this is a mistake.')).toBe(true);
    expect(isSuspendedRefusal('Invalid email or password')).toBe(false);
    expect(isSuspendedRefusal(undefined)).toBe(false);
  });

  it('will not send an appeal without at least a sentence', () => {
    render(<SuspensionAppeal email="her@example.com" password="pw" />);

    fireEvent.change(screen.getByLabelText('Why the suspension should be lifted'), { target: { value: 'no' } });

    expect(screen.getByRole('button', { name: 'Send appeal' })).toBeDisabled();
  });

  it('sends her reason with the credentials she typed, and shows the answer the server gives', async () => {
    fetchMock.mockReturnValue(reply(201, { message: 'Your appeal has been sent and a person will look at it.' }));
    render(<SuspensionAppeal email="her@example.com" password="pw" />);

    fireEvent.change(screen.getByLabelText('Why the suspension should be lifted'), {
      target: { value: 'I was reported by someone trying to get me off the platform.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send appeal' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Your appeal has been sent');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/suspension-appeal');
    expect(JSON.parse(init.body)).toEqual({
      email: 'her@example.com',
      password: 'pw',
      reason: 'I was reported by someone trying to get me off the platform.',
    });
  });

  it('shows the server’s reason when the appeal is refused, rather than a success', async () => {
    fetchMock.mockReturnValue(reply(409, { message: 'Your appeal is already with a reviewer.' }));
    render(<SuspensionAppeal email="her@example.com" password="pw" />);

    fireEvent.change(screen.getByLabelText('Why the suspension should be lifted'), {
      target: { value: 'Please look at this again, it was a mistake.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send appeal' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('already with a reviewer'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
