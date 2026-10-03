import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Closing an account, the one way it is now asked.
 *
 * It cannot be undone, so it says plainly what it does (the personal
 * information is erased at once, a paid membership ends today, a few records
 * the law requires are kept without her name), asks again for her password and,
 * when two-factor is on, her second factor, and holds the button until she has
 * typed the phrase. A refusal is shown beside the boxes, in the server's words,
 * because "nothing has been deleted" is the thing she most needs to be told.
 */

const mutation = {
  mutate: jest.fn(),
  isPending: false,
  error: null as unknown,
  reset: jest.fn(),
};
jest.mock('@/lib/hooks', () => ({ useDeleteAccount: () => mutation }));

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }));

import { DeleteAccountDialog } from './DeleteAccountDialog';

function renderDialog(open = true, onClose = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DeleteAccountDialog open={open} onClose={onClose} />
    </QueryClientProvider>
  );
  return { onClose };
}

const confirmBox = () => screen.getByLabelText(/Type DELETE_MY_ACCOUNT to confirm/);
const deleteButton = () => screen.getByRole('button', { name: /Delete my account|Deleting/ });

beforeEach(() => {
  jest.clearAllMocks();
  mutation.isPending = false;
  mutation.error = null;
  mockGet.mockResolvedValue({ data: { data: { enabled: false } } });
});

describe('what it says', () => {
  it('is not on the page until it is opened, and asks the server nothing until then', () => {
    renderDialog(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('says what happens, in plain words: erased at once, billing ends, some records stay without her name, backups age out', () => {
    renderDialog();

    const text = screen.getByRole('dialog', { name: 'Delete your account' }).textContent ?? '';
    expect(text).toMatch(/erase your profile, posts, messages and the rest of your personal information straight away/i);
    expect(text).toMatch(/membership, it ends today and you are not charged again/i);
    expect(text).toMatch(/if we cannot end it, nothing is deleted/i);
    expect(text).toMatch(/seven years without your name or anything that identifies you/i);
    expect(text).toMatch(/backups are not removed at once/i);
    // And no longer promises a thirty-day wait that does not happen.
    expect(text).not.toMatch(/30 days|thirty days/i);
  });
});

describe('asking who is at the keyboard', () => {
  it('asks for her password, and says that a Google or Facebook only account leaves it empty', () => {
    renderDialog();

    expect(screen.getByLabelText('Your password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Your password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('dialog').textContent).toMatch(/only ever sign in with Google or Facebook.*leave this empty/i);
  });

  it('asks for the code as an extra only when two-factor is not known to be on, and plainly when it is', async () => {
    renderDialog();
    expect(screen.getByLabelText(/only if you use two-factor/)).toBeInTheDocument();

    mockGet.mockResolvedValue({ data: { data: { enabled: true } } });
    renderDialog();
    expect(await screen.findAllByLabelText('Authenticator code or recovery code')).not.toHaveLength(0);
  });

  it('takes a recovery code as well as six digits: up to 32 characters, and not a numeric field', () => {
    renderDialog();

    const code = screen.getByLabelText(/Authenticator code or recovery code/);
    expect(code).toHaveAttribute('maxlength', '32');
    expect(code).not.toHaveAttribute('inputmode', 'numeric');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
  });
});

describe('pressing the button', () => {
  it('is held until the phrase has been typed exactly', () => {
    renderDialog();

    expect(deleteButton()).toBeDisabled();
    fireEvent.change(confirmBox(), { target: { value: 'delete my account' } });
    expect(deleteButton()).toBeDisabled();
    fireEvent.change(confirmBox(), { target: { value: 'DELETE_MY_ACCOUNT' } });
    expect(deleteButton()).toBeEnabled();
  });

  it('sends the password and the code she typed, and nothing she left empty', () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'her-password' } });
    fireEvent.change(screen.getByLabelText(/Authenticator code or recovery code/), { target: { value: ' ABCDE-FGHJK ' } });
    fireEvent.change(confirmBox(), { target: { value: 'DELETE_MY_ACCOUNT' } });

    fireEvent.click(deleteButton());

    expect(mutation.mutate).toHaveBeenCalledWith({ currentPassword: 'her-password', code: 'ABCDE-FGHJK' });
  });

  it('sends neither when she has neither: a Google or Facebook only account with no two-factor', () => {
    renderDialog();
    fireEvent.change(confirmBox(), { target: { value: 'DELETE_MY_ACCOUNT' } });

    fireEvent.click(deleteButton());

    expect(mutation.mutate).toHaveBeenCalledWith({});
  });

  it('does not send twice while it is working', () => {
    mutation.isPending = true;
    renderDialog();
    fireEvent.change(confirmBox(), { target: { value: 'DELETE_MY_ACCOUNT' } });

    expect(deleteButton()).toBeDisabled();
    expect(deleteButton()).toHaveTextContent('Deleting');
    fireEvent.submit(screen.getByRole('dialog'));
    expect(mutation.mutate).not.toHaveBeenCalled();
  });
});

describe('when it is refused', () => {
  it('shows the server’s own sentence beside the boxes, so nothing has been deleted is not left to a guess', async () => {
    mutation.error = {
      response: {
        status: 409,
        data: { success: false, message: 'We could not end your membership billing just now, so your account has not been deleted and nothing has changed.' },
      },
    };
    renderDialog();

    expect(await screen.findByRole('alert')).toHaveTextContent(/has not been deleted and nothing has changed/);
  });

  it('shows a refused password as the server says it', () => {
    mutation.error = { response: { status: 401, data: { success: false, message: 'Current password is incorrect' } } };
    renderDialog();

    expect(screen.getByRole('alert')).toHaveTextContent('Current password is incorrect');
  });

  it('says so, and that nothing was deleted, when the server could not be reached', () => {
    mutation.error = new Error('Network Error');
    renderDialog();

    expect(screen.getByRole('alert')).toHaveTextContent(/could not reach the server.*nothing has been deleted/i);
  });
});

describe('getting out of it', () => {
  it('closes on Cancel and clears what she typed, so a password is not left in the page', () => {
    const { onClose } = renderDialog();
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'her-password' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutation.reset).toHaveBeenCalled();
    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is not closed by Escape in the middle of an erasure', async () => {
    mutation.isPending = true;
    const { onClose } = renderDialog();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(onClose).not.toHaveBeenCalled());
  });

  it('has thumb-sized buttons and boxes', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Cancel' }).className).toMatch(/min-h-11/);
    expect(deleteButton().className).toMatch(/min-h-11/);
    expect(confirmBox().className).toMatch(/min-h-11/);
    expect(screen.getByLabelText('Your password').className).toMatch(/min-h-11/);
  });
});
