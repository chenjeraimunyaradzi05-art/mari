import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * "Your provider check". A place can show as checked only while whoever lists it
 * holds an approved provider check, so this is where a member asks, sees where it
 * stands, and asks again. The panel says what is checked and what is not, and it
 * never shows the notes staff wrote when they approved: only the reason for a
 * refusal is the member's to read.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ housingApi: { getMyProviderCheck: jest.fn(), askForProviderCheck: jest.fn() } }));

import toast from 'react-hot-toast';
import { housingApi } from '@/lib/api';
import { ProviderCheckPanel } from './ProviderCheckPanel';

const api = housingApi as unknown as { getMyProviderCheck: jest.Mock; askForProviderCheck: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const RELATIONSHIPS = [
  { value: 'OWNER', label: 'I own the places I list' },
  { value: 'AGENT', label: 'I am an agent or manager for the owner' },
  { value: 'SERVICE', label: 'I list places for a housing service or charity' },
];

const status = (over: Record<string, unknown> = {}) => ({
  data: { data: { standing: 'NONE', canApply: true, renewable: false, relationships: RELATIONSHIPS, renewalWindowDays: 30, ...over } },
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProviderCheckPanel />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Your provider check', () => {
  it('says what is checked and what is not, before asking for anything', async () => {
    api.getMyProviderCheck.mockResolvedValue(status());
    renderPanel();

    expect(await screen.findByText('You have not asked to be checked yet.')).toBeInTheDocument();
    expect(screen.getByText(/We do not run police or background checks, and we do not ask for one/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your provider check' })).toBeInTheDocument();
  });

  it('sends the request as typed, and says what happens next', async () => {
    api.getMyProviderCheck.mockResolvedValue(status());
    api.askForProviderCheck.mockResolvedValue({ data: { message: 'Sent. A member of staff will look at it.' } });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Ask to be checked' }));
    fireEvent.change(screen.getByLabelText('Your name, or the name of the service'), { target: { value: 'Quiet Streets Housing' } });
    fireEvent.change(screen.getByLabelText('How you are connected to the places you list'), { target: { value: 'SERVICE' } });
    fireEvent.change(screen.getByLabelText('ABN (if you have one)'), { target: { value: '51 824 753 556' } });
    fireEvent.change(screen.getByLabelText('Tell us about the places you list and how you know them'), {
      target: { value: 'We run three units for women leaving violence in Brisbane.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send for a check' }));

    await waitFor(() => expect(api.askForProviderCheck).toHaveBeenCalledTimes(1));
    expect(api.askForProviderCheck).toHaveBeenCalledWith({
      providerName: 'Quiet Streets Housing',
      relationship: 'SERVICE',
      abn: '51 824 753 556',
      statement: 'We run three units for women leaving violence in Brisbane.',
    });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Sent. A member of staff will look at it.', expect.anything()));
  });

  it('will not send a statement too short to be read, and leaves the ABN out when none was typed', async () => {
    api.getMyProviderCheck.mockResolvedValue(status());
    api.askForProviderCheck.mockResolvedValue({ data: {} });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Ask to be checked' }));
    fireEvent.change(screen.getByLabelText('Your name, or the name of the service'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Tell us about the places you list and how you know them'), { target: { value: 'Short' } });
    expect(screen.getByRole('button', { name: 'Send for a check' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Tell us about the places you list and how you know them'), {
      target: { value: 'A spare room in my own home that I rent out.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send for a check' }));
    await waitFor(() => expect(api.askForProviderCheck).toHaveBeenCalled());
    expect(api.askForProviderCheck.mock.calls[0][0]).not.toHaveProperty('abn');
  });

  it('shows the server’s own sentence when it refuses', async () => {
    api.getMyProviderCheck.mockResolvedValue(status());
    api.askForProviderCheck.mockRejectedValue({ response: { data: { message: 'abn is not a valid ABN. It is 11 digits.' } } });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Ask to be checked' }));
    fireEvent.change(screen.getByLabelText('Your name, or the name of the service'), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByLabelText('Tell us about the places you list and how you know them'), { target: { value: 'A spare room in my own home that I rent out.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send for a check' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('abn is not a valid ABN. It is 11 digits.'));
  });

  it('shows an approval with its end date, offers no second request, and shows nothing staff wrote', async () => {
    api.getMyProviderCheck.mockResolvedValue(
      status({ standing: 'APPROVED', canApply: false, expiresAt: '2027-09-30T00:00:00.000Z', providerName: 'Quiet Streets Housing' })
    );
    renderPanel();

    expect(await screen.findByText(/Approved\. It stands until/)).toBeInTheDocument();
    expect(screen.getByText(/30 September 2027|1 October 2027/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ask/ })).not.toBeInTheDocument();
  });

  it('offers a renewal in the last month of an approval', async () => {
    api.getMyProviderCheck.mockResolvedValue(status({ standing: 'APPROVED', canApply: true, renewable: true, expiresAt: '2026-10-20T00:00:00.000Z' }));
    renderPanel();

    expect(await screen.findByText(/It ends within 30 days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask for a renewal' })).toBeInTheDocument();
  });

  it('shows the reason a check was refused, and lets the member ask again', async () => {
    api.getMyProviderCheck.mockResolvedValue(status({ standing: 'REJECTED', canApply: true, decisionNote: 'We could not match the ABN to the name you gave.' }));
    renderPanel();

    expect(await screen.findByText('It was not approved.')).toBeInTheDocument();
    expect(screen.getByText('We could not match the ABN to the name you gave.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask again' })).toBeInTheDocument();
  });

  it('says a waiting request is waiting, and that places that need it stay off the list', async () => {
    api.getMyProviderCheck.mockResolvedValue(status({ standing: 'PENDING', canApply: false }));
    renderPanel();

    expect(await screen.findByText(/Waiting for a member of staff/)).toBeInTheDocument();
    expect(screen.getByText(/stay off the list until then/)).toBeInTheDocument();
  });

  it('says a check that ended took its places off the list', async () => {
    api.getMyProviderCheck.mockResolvedValue(status({ standing: 'EXPIRED', canApply: true }));
    renderPanel();
    expect(await screen.findByText(/It has ended\. Places that rested on it are off the list/)).toBeInTheDocument();
  });

  it('says so when it cannot load, rather than showing a member who has never asked', async () => {
    api.getMyProviderCheck.mockRejectedValue(new Error('network'));
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByText('You have not asked to be checked yet.')).not.toBeInTheDocument();
  });
});
