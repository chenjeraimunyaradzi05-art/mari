import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * The Safety Center's own report form, for the two reasons that had no name
 * (an intimate image shared without consent, and a threat) and for what it says
 * once one is filed.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../dashboard/safety/QuickExit', () => ({ QuickExitButton: () => null }));

jest.mock('@/lib/api', () => ({
  safetyApi: {
    getReports: jest.fn(),
    getBlocks: jest.fn(),
    getSettings: jest.fn(),
    createReport: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    updateSettings: jest.fn(),
  },
}));

import { safetyApi } from '@/lib/api';
import SafetyCenterPage from './page';

const safety = safetyApi as unknown as Record<'getReports' | 'getBlocks' | 'getSettings' | 'createReport' | 'blockUser' | 'unblockUser' | 'updateSettings', jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  safety.getReports.mockResolvedValue({ data: { data: [] } });
  safety.getBlocks.mockResolvedValue({ data: { data: [] } });
  safety.getSettings.mockResolvedValue({ data: { data: { allowMessages: true, isSafeMode: false, hideFromSearch: false } } });
  safety.createReport.mockResolvedValue({ data: { data: { reference: 'RPT-1', reviewHours: 24 } } });
});

async function fileReport(reasonValue: string) {
  render(<SafetyCenterPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Report Content/ }));
  fireEvent.change(await screen.findByLabelText('ID of what you are reporting'), { target: { value: 'post-1' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: reasonValue } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
}

describe('the reasons', () => {
  it('name an intimate image and a threat', async () => {
    render(<SafetyCenterPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Report Content/ }));

    const reasons = (await screen.findAllByRole('option')).map((option) => ({ value: (option as HTMLOptionElement).value, label: option.textContent }));
    expect(reasons).toContainEqual({ value: 'intimate_image', label: 'An intimate image of someone, shared without consent' });
    expect(reasons).toContainEqual({ value: 'threat', label: 'A threat to hurt someone' });
  });
});

describe('after a report is filed', () => {
  it('says where else to turn for an intimate image: the eSafety Commissioner, and the police', async () => {
    await fileReport('intimate_image');

    await waitFor(() => expect(safety.createReport).toHaveBeenCalledWith(expect.objectContaining({ reason: 'intimate_image', targetId: 'post-1' })));
    expect(await screen.findByText(/Your reference is RPT-1/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Report to the eSafety Commissioner/ })).toHaveAttribute('href', 'https://www.esafety.gov.au/report');
    expect(screen.getByRole('link', { name: /Policelink 131 444/ })).toHaveAttribute('href', 'tel:131444');
  });

  it('puts 000 first for a threat', async () => {
    await fileReport('threat');

    expect(await screen.findByText(/call 000 and do not wait for us/)).toBeInTheDocument();
  });

  it('adds nothing for a report that has nowhere else to go', async () => {
    await fileReport('spam');

    expect(await screen.findByText(/Your reference is RPT-1/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /eSafety/ })).not.toBeInTheDocument();
  });
});
