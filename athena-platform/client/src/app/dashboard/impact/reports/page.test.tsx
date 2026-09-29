import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

/**
 * The public reports page. A count the server withheld is shown as "fewer
 * than five", never as a zero, and the tiles are the latest report, named,
 * rather than a total across reports that would count a woman twice.
 */

jest.mock('@/lib/api', () => ({ impactApi: { getReports: jest.fn() }, api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock('@/lib/hooks', () => ({ useAuthStore: () => ({ user: { role: 'USER' } }) }));

import { impactApi } from '@/lib/api';
import ReportsPage from './page';

const getReports = impactApi.getReports as jest.Mock;

const report = (over: Record<string, unknown>) => ({
  id: 'r',
  reportPeriod: 'Q1-2026',
  communityType: null,
  region: 'ANZ',
  totalUsersSupported: 40,
  employmentGained: 12,
  housingSecured: null,
  qualificationsObtained: 0,
  businessesStarted: 6,
  safetyAchieved: null,
  avgIncomeIncrease: null,
  totalEconomicImpact: null,
  narrativeSummary: null,
  suppressed: ['housingSecured', 'safetyAchieved'],
  minPublishedCount: 5,
  basis: { period: { description: '1 Jan 2026 to 31 Mar 2026' }, outcomesRecorded: 30, outcomesVerified: 0, programmeMembers: 20 },
  ...over,
});

describe('Impact reports page', () => {
  it('shows withheld counts as fewer than five and names the report the tiles come from', async () => {
    getReports.mockResolvedValue({ data: { data: [report({ id: 'r2', reportPeriod: 'Q2-2026', totalUsersSupported: 55 }), report({ id: 'r1' })] } });
    render(<ReportsPage />);

    expect(await screen.findByText(/Latest report:/)).toHaveTextContent('Latest report: Q2-2026');
    // The tiles are Q2's alone, not Q1 and Q2 added together.
    expect(screen.getAllByText('55').length).toBeGreaterThan(0);
    expect(screen.queryByText('95')).not.toBeInTheDocument();
    expect(screen.getAllByText('Fewer than 5').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Counted from ATHENA’s records for 1 Jan 2026 to 31 Mar 2026/).length).toBeGreaterThan(0);
    // Members do not see the staff panel.
    expect(screen.queryByText(/Staff: publish an impact report/)).not.toBeInTheDocument();
  });

  it('says plainly that nothing is published, and a failure is not that', async () => {
    getReports.mockResolvedValueOnce({ data: { data: [] } });
    const { unmount } = render(<ReportsPage />);
    expect(await screen.findByText('No impact report has been published yet')).toBeInTheDocument();
    unmount();

    getReports.mockRejectedValueOnce({ response: { data: { error: 'Failed to load reports' } } });
    render(<ReportsPage />);
    expect(await screen.findByText('Failed to load reports')).toBeInTheDocument();
    expect(screen.queryByText('No impact report has been published yet')).not.toBeInTheDocument();
  });
});
