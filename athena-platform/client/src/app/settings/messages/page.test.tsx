import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The message settings page used to offer "Filter offensive content: automatically
 * screen incoming messages for abusive language". The switch was stored and
 * read back and nothing else read it; messages are screened the same way for
 * everyone. A control that promises protection it does not give is worse than
 * none, so it is gone, and what the page offers it keeps.
 */

const getSettings = jest.fn();
const updateSettings = jest.fn();
const getPreferences = jest.fn();
const updatePreferences = jest.fn();

jest.mock('@/lib/api', () => ({
  safetyApi: {
    getSettings: (...args: unknown[]) => getSettings(...args),
    updateSettings: (...args: unknown[]) => updateSettings(...args),
  },
  notificationApi: {
    getPreferences: (...args: unknown[]) => getPreferences(...args),
    updatePreferences: (...args: unknown[]) => updatePreferences(...args),
  },
}));

import MessagesSettingsPage from './page';

beforeEach(() => {
  getSettings.mockReset();
  updateSettings.mockReset();
  getPreferences.mockReset();
  updatePreferences.mockReset();
  getSettings.mockResolvedValue({ data: { data: { allowMessagesFrom: 'all', hideReadReceipts: true } } });
  getPreferences.mockResolvedValue({ data: { data: { push: { messages: true }, email: { messages: false } } } });
  updateSettings.mockResolvedValue({ data: { success: true } });
  updatePreferences.mockResolvedValue({ data: { success: true } });
});

describe('the message settings page', () => {
  it('does not offer a switch that nothing honours', async () => {
    render(<MessagesSettingsPage />);
    await waitFor(() => expect(getSettings).toHaveBeenCalled());

    expect(screen.queryByText(/filter offensive content/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/automatically screen incoming messages/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/spam protection/i)).not.toBeInTheDocument();
  });

  it('says where the real tools are: report and block on the conversation, and where to undo a block', async () => {
    render(<MessagesSettingsPage />);
    await waitFor(() => expect(getSettings).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: /if someone is bothering you/i })).toBeInTheDocument();
    expect(screen.getByText(/Report member/)).toBeInTheDocument();
    expect(screen.getByText(/Block member/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings > privacy/i })).toHaveAttribute('href', '/dashboard/settings/privacy');
  });

  it('saves only what the server keeps and enforces: who may message her and her read receipts', async () => {
    render(<MessagesSettingsPage />);
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled());

    // She chooses connections only; her read receipts stay as they were.
    fireEvent.click(screen.getByLabelText(/connections only/i));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(updateSettings).toHaveBeenCalledWith({ allowMessagesFrom: 'connections', hideReadReceipts: true });
    expect(Object.keys(updateSettings.mock.calls[0][0])).not.toContain('filterOffensiveContent');
    expect(await screen.findByText(/message settings saved/i)).toBeInTheDocument();
  });
});
