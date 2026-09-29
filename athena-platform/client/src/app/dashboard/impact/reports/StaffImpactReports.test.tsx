import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Staff publishing an impact report. The panel counts a period before it can
 * be published, shows the server's refusal when there is one instead of a
 * publish button, sends only the scope and the narrative (never a figure),
 * and says so when the published list could not be loaded rather than
 * showing an empty one.
 */

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));

import { api } from '@/lib/api';
import { StaffImpactReports } from './StaffImpactReports';

const http = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock };

const figures = {
  totalUsersSupported: 12,
  employmentGained: 6,
  housingSecured: 2,
  qualificationsObtained: 0,
  businessesStarted: 5,
  safetyAchieved: 1,
  avgIncomeIncrease: null,
};
const basis = {
  period: { label: 'Q1-2026', description: '1 Jan 2026 to 31 Mar 2026' },
  outcomesRecorded: 14,
  outcomesVerified: 0,
  programmeMembers: 3,
  incomeReports: 0,
};

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
  http.patch.mockReset();
});

const respond = (preview: unknown, published: unknown[] = []) =>
  http.get.mockImplementation(async (url: string) => {
    if (url === '/impact/admin/reports') return { data: { data: published } };
    if (url === '/impact/admin/reports/preview') return { data: { data: preview } };
    throw new Error(`unexpected ${url}`);
  });

describe('StaffImpactReports', () => {
  it('counts a period, then publishes it with the scope and narrative only', async () => {
    respond({ figures, basis, publishable: true, refusal: null });
    http.post.mockResolvedValue({ data: { message: 'Published the report for Q1-2026 (survivors of domestic violence, ANZ).' } });
    const onPublished = jest.fn();
    render(<StaffImpactReports onPublished={onPublished} />);

    expect(await screen.findByText('None published yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'Q1-2026' } });
    fireEvent.change(screen.getByLabelText('Community'), { target: { value: 'DV_SURVIVOR' } });
    fireEvent.click(screen.getByRole('button', { name: /Count this period/ }));

    expect(await screen.findByText(/14 outcomes recorded by members/)).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith('/impact/admin/reports/preview', { params: { period: 'Q1-2026', communityType: 'DV_SURVIVOR', region: 'ANZ' } });

    fireEvent.change(screen.getByLabelText('Narrative (optional)'), { target: { value: 'Our first quarter.' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish this report/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Published the report for Q1-2026');
    expect(http.post).toHaveBeenCalledWith('/impact/admin/reports', { period: 'Q1-2026', communityType: 'DV_SURVIVOR', region: 'ANZ', narrativeSummary: 'Our first quarter.' });
    expect(onPublished).toHaveBeenCalled();
  });

  it('shows why a period cannot be published, and offers no publish button', async () => {
    respond({ figures: { ...figures, totalUsersSupported: 3 }, basis, publishable: false, refusal: 'Fewer than 5 women are counted in this period, region and community.' });
    render(<StaffImpactReports />);

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'Q1-2026' } });
    fireEvent.click(screen.getByRole('button', { name: /Count this period/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Fewer than 5 women are counted');
    expect(screen.queryByRole('button', { name: /Publish this report/ })).not.toBeInTheDocument();
  });

  it('says the published list could not be loaded, rather than that there are none', async () => {
    http.get.mockRejectedValue(new Error('network'));
    render(<StaffImpactReports />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByText('None published yet.')).not.toBeInTheDocument();
  });

  it('corrects a published report with a reason and a recount', async () => {
    respond(null, [{ id: 'rep-1', reportPeriod: 'Q1-2026', communityType: null, region: 'ANZ', narrativeSummary: 'First quarter.', basis, createdAt: '2026-04-02', ...figures }]);
    http.patch.mockResolvedValue({ data: { message: 'Corrected.' } });
    render(<StaffImpactReports />);

    fireEvent.click(await screen.findByRole('button', { name: 'Correct or withdraw' }));
    fireEvent.click(screen.getByLabelText(/Recount the figures/));
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: 'Two outcomes were recorded late' } });
    fireEvent.click(screen.getByRole('button', { name: /Save correction/ }));

    await waitFor(() => expect(http.patch).toHaveBeenCalledWith('/impact/admin/reports/rep-1', { reason: 'Two outcomes were recorded late', recount: true }));
  });
});
