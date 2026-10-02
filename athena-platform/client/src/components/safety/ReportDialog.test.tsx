import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The report dialog, for what a woman can report and what she is told after.
 *
 * She used to have to guess which of "sexual content" and "violence" an intimate
 * image shared without her consent came under, and she was told "thanks" and
 * nothing more, left to find the eSafety Commissioner and the police alone. Both
 * of those are named now, and a report that has somewhere else to go says so.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

const createReport = jest.fn();
jest.mock('@/lib/api', () => ({ safetyApi: { createReport: (...args: unknown[]) => createReport(...args) } }));

import { ReportDialog } from './ReportDialog';

const onClose = jest.fn();

function openDialog() {
  return render(<ReportDialog open onClose={onClose} targetType="post" targetId="p1" targetLabel="this post" />);
}

beforeEach(() => {
  jest.clearAllMocks();
  createReport.mockResolvedValue({ data: { data: { reference: 'RPT-1', reviewHours: 24 } } });
});

describe('the reasons', () => {
  it('names an intimate image and a threat, so she does not have to guess', () => {
    openDialog();

    expect(screen.getByLabelText('An intimate image of someone, shared without consent')).toBeInTheDocument();
    expect(screen.getByLabelText('A threat to hurt someone')).toBeInTheDocument();
    // The older one is still there, for anything that is not a threat.
    expect(screen.getByLabelText('Violence or threats')).toBeInTheDocument();
  });

  it('sends the reason the server reads, by its own name', async () => {
    openDialog();

    fireEvent.click(screen.getByLabelText('An intimate image of someone, shared without consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(createReport).toHaveBeenCalledWith({ targetType: 'post', targetId: 'p1', reason: 'intimate_image', details: undefined }));
  });
});

describe('after an intimate image is reported', () => {
  it('stays open with where else to turn, instead of closing on "thanks"', async () => {
    openDialog();

    fireEvent.click(screen.getByLabelText('An intimate image of someone, shared without consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText(/Your report is with our safety team/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    const esafety = screen.getByRole('link', { name: /Report to the eSafety Commissioner/ });
    expect(esafety).toHaveAttribute('href', 'https://www.esafety.gov.au/report');
    expect(esafety).toHaveAttribute('target', '_blank');
    expect(esafety).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: /Policelink 131 444/ })).toHaveAttribute('href', 'tel:131444');
    expect(screen.getByRole('link', { name: /Call 000 if you are in danger now/ })).toHaveAttribute('href', 'tel:000');
  });

  it('closes when she is done, and the next report starts from the form again', async () => {
    const { rerender } = openDialog();
    fireEvent.click(screen.getByLabelText('An intimate image of someone, shared without consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await screen.findByText(/Your report is with our safety team/);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ReportDialog open onClose={onClose} targetType="post" targetId="p2" />);
    expect(screen.queryByText(/Your report is with our safety team/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeInTheDocument();
  });
});

describe('after a threat is reported', () => {
  it('puts 000 first, and says not to wait for us if anyone is in danger now', async () => {
    openDialog();

    fireEvent.click(screen.getByLabelText('A threat to hurt someone'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText(/call 000 and do not wait for us/)).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', 'tel:000');
  });
});

describe('after any other report', () => {
  it('closes as it always did, with nothing added', async () => {
    openDialog();

    fireEvent.click(screen.getByLabelText('Spam or misleading'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('link', { name: /eSafety/ })).not.toBeInTheDocument();
  });

  it('keeps the form, and says so, when the report could not be sent', async () => {
    createReport.mockRejectedValue({ response: { data: { message: 'Too many reports' } } });
    openDialog();

    fireEvent.click(screen.getByLabelText('An intimate image of someone, shared without consent'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(createReport).toHaveBeenCalled());
    expect(screen.queryByText(/Your report is with our safety team/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeInTheDocument();
  });
});
