import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The calendar file is something she asks for, and the discreet one has to be
 * the one she asked for: a calendar synced to a shared account shows whatever
 * the file says. And a refusal (not registered, or a cancelled event) comes
 * back from the server as a file-shaped response, so its reason has to be
 * read out of it rather than replaced with a generic failure.
 */

const mockGet = jest.fn();
jest.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => mockGet(...args) } }));

const mockToastError = jest.fn();
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: (...args: unknown[]) => mockToastError(...args) },
}));

import { AddToCalendar } from '@/components/events/AddToCalendar';

describe('AddToCalendar', () => {
  const createObjectURL = jest.fn(() => 'blob:calendar');
  const revokeObjectURL = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  it('asks for the discreet file when she chooses it, and saves it under a neutral name', async () => {
    mockGet.mockResolvedValue({ data: new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' }) });
    const clicked: string[] = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });

    render(<AddToCalendar eventId="ev1" />);
    fireEvent.click(screen.getByRole('button', { name: /Add discreetly/ }));

    await waitFor(() => expect(clicked).toEqual(['appointment.ics']));
    expect(mockGet).toHaveBeenCalledWith('/events/ev1/calendar.ics', { params: { discreet: '1' }, responseType: 'blob' });
    click.mockRestore();
  });

  it('asks for the full file by name when she chooses that', async () => {
    mockGet.mockResolvedValue({ data: new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' }) });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<AddToCalendar eventId="ev1" />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/events/ev1/calendar.ics', { params: { discreet: '0' }, responseType: 'blob' }));
    click.mockRestore();
  });

  it('shows the server’s reason when it refuses', async () => {
    mockGet.mockRejectedValue({
      response: {
        status: 409,
        data: new Blob([JSON.stringify({ success: false, message: 'This event has been cancelled, so there is nothing to add to your calendar.' })], {
          type: 'application/json',
        }),
      },
    });

    render(<AddToCalendar eventId="ev1" />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('This event has been cancelled, so there is nothing to add to your calendar.')
    );
  });

  it('says the download failed, rather than nothing, when there is no reason to show', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'));

    render(<AddToCalendar eventId="ev1" />);
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('The calendar file did not download. Try again in a moment.'));
  });
});
