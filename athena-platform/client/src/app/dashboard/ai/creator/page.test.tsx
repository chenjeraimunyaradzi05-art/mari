import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
  aiAlgorithmsApi: { getCreatorAnalytics: jest.fn(), getIncomeProjections: jest.fn() },
}));

import CreatorAnalyticsPage from './page';
import { api, aiAlgorithmsApi } from '@/lib/api';

const algorithms = aiAlgorithmsApi as unknown as {
  getCreatorAnalytics: jest.Mock;
  getIncomeProjections: jest.Mock;
};
const http = api as unknown as { get: jest.Mock };

/** What /api/algorithms/income-stream returns for a member with no gifts yet. */
const QUIET_INCOME_STREAM = {
  creatorStatus: 'non_creator',
  revenuePotentialScore: 0,
  diversificationScore: 40,
  monthlyEarnings: 0,
  avgGiftValue: 0,
  followerCount: 0,
  actionPlan: ['Schedule 2 revenue-focused live sessions per week.'],
  channels: [{ name: 'Gifts', currentShare: 55, potentialShare: 45 }],
};

/**
 * The exact row GET /ai-algorithms/creator-analytics hands back to a member who
 * has just opened the page: the endpoint creates it with nothing but a tier.
 * The page used to be typed against a different, imagined model and threw a
 * TypeError on this payload for every single user, which is why the shape is
 * spelled out here in full rather than trimmed to the fields a test happens to
 * assert on.
 */
const NEW_CREATOR_ROW = {
  id: 'analytics-1',
  userId: 'user-1',
  followerCount: 0,
  followingCount: 0,
  followerGrowth: null,
  totalVideos: 0,
  totalViews: 0,
  avgViews: null,
  totalLikes: 0,
  avgEngagementRate: null,
  audienceGender: null,
  audienceAge: null,
  audienceLocation: null,
  peakActiveHours: null,
  totalEarnings: '0',
  monthlyEarnings: null,
  revenueBySource: null,
  creatorTier: 'BRONZE',
  isMonetized: false,
  monetizedAt: null,
  projectedIncome: null,
  topRevenueStreams: null,
  monetizationRoadmap: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const respond = (analytics: unknown, projections: unknown, income: unknown = QUIET_INCOME_STREAM) => {
  algorithms.getCreatorAnalytics.mockResolvedValue({ data: { data: analytics } });
  algorithms.getIncomeProjections.mockResolvedValue({ data: { data: projections } });
  http.get.mockResolvedValue({ data: { success: true, data: income } });
};

describe('Creator analytics page', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the row the server actually returns, without inventing figures', async () => {
    // The projections endpoint models income from followers and engagement, so
    // for a brand-new creator it returns three zeros. A zero produced by a
    // formula that had nothing to work with is not a forecast, and the page
    // must not present it as one.
    respond(NEW_CREATOR_ROW, {
      followerCount: 0,
      avgEngagementRate: null,
      creatorTier: 'BRONZE',
      projectedIncome: { conservative: 0, realistic: 0, optimistic: 0 },
      topRevenueStreams: null,
      monetizationRoadmap: null,
    });

    render(<CreatorAnalyticsPage />);

    expect(await screen.findByText(/We have not measured your reach yet/i)).toBeInTheDocument();
    expect(screen.getByText('bronze')).toBeInTheDocument();
    expect(screen.getByText(/Monetisation is not switched on/i)).toBeInTheDocument();
    expect(screen.queryByText(/Monthly income, modelled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Revenue on record/i)).not.toBeInTheDocument();

    // A zero gift total is a real measurement — nobody sent her one — so unlike
    // the placeholder counters it is shown rather than hidden.
    expect(screen.getByText(/Gifts received, last 30 days/i)).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('never prints the fixed revenue-mix percentages as her own', async () => {
    respond(NEW_CREATOR_ROW, null, {
      ...QUIET_INCOME_STREAM,
      monthlyEarnings: 42,
      channels: [
        { name: 'Gifts', currentShare: 55, potentialShare: 45 },
        { name: 'Brand Deals', currentShare: 15, potentialShare: 20 },
      ],
    });

    render(<CreatorAnalyticsPage />);
    await screen.findByText(/Gifts received, last 30 days/i);

    // currentShare is a constant in algorithm.service, identical for every
    // member. Rendering it would be telling a creator where her money comes
    // from on the strength of a hardcoded array.
    expect(screen.queryByText('Brand Deals')).not.toBeInTheDocument();
    expect(screen.queryByText(/55%/)).not.toBeInTheDocument();
  });

  it('shows the figures the row does hold', async () => {
    respond(
      {
        ...NEW_CREATOR_ROW,
        followerCount: 1240,
        totalVideos: 12,
        totalViews: 48200,
        avgViews: 4016,
        totalLikes: 3100,
        avgEngagementRate: 0.082,
        audienceGender: { woman: 71, man: 24, non_binary: 5 },
        peakActiveHours: [19, 20, 21],
        totalEarnings: '1450',
        revenueBySource: { gifts: 900, sponsorships: 550 },
        creatorTier: 'SILVER',
        isMonetized: true,
        monetizedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        followerCount: 1240,
        avgEngagementRate: 0.082,
        creatorTier: 'SILVER',
        projectedIncome: { conservative: 10, realistic: 30, optimistic: 80 },
        topRevenueStreams: [{ stream: 'Sponsorships', potential: 15, effort: 'MEDIUM' }],
        monetizationRoadmap: null,
      },
      {
        ...QUIET_INCOME_STREAM,
        creatorStatus: 'growing',
        monthlyEarnings: 128.4,
        avgGiftValue: 3.2,
      }
    );

    render(<CreatorAnalyticsPage />);

    expect(await screen.findByText('1.2K')).toBeInTheDocument();
    expect(screen.getByText('48.2K')).toBeInTheDocument();
    // Stored as a ratio, shown as the percentage a creator recognises.
    expect(screen.getByText('8.2%')).toBeInTheDocument();
    expect(screen.getByText('woman')).toBeInTheDocument();
    expect(screen.getByText('7pm')).toBeInTheDocument();
    expect(screen.getByText('Sponsorships')).toBeInTheDocument();
    expect(screen.getByText(/1,450/)).toBeInTheDocument();
    expect(screen.getByText('$128.40')).toBeInTheDocument();
    expect(screen.getByText(/Monetisation is on/i)).toBeInTheDocument();
    expect(screen.queryByText(/We have not measured your reach yet/i)).not.toBeInTheDocument();
  });

  it('no longer reads the six fields the model never had', async () => {
    respond(NEW_CREATOR_ROW, null);

    render(<CreatorAnalyticsPage />);
    await screen.findByText(/We have not measured your reach yet/i);

    // Each of these headings was rendered from a field that does not exist on
    // CreatorAnalytics. Their absence is the regression guard.
    expect(screen.queryByText(/Top Categories/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Peak Viewing Hours/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Top Performing Content/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Growth Recommendations/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Avg. Watch Time/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });
});
