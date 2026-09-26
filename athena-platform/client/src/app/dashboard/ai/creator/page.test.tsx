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

/**
 * What /api/algorithms/income-stream returns for a member with no gifts yet.
 * It no longer carries `channels`, `revenuePotentialScore` or
 * `diversificationScore`; the test below that feeds the page a stale payload
 * with `channels` in it is the guard for a server that still sends them.
 */
const QUIET_INCOME_STREAM = {
  creatorStatus: 'non_creator',
  monthlyEarnings: 0,
  avgGiftValue: 0,
  followerCount: 0,
  actionPlan: ['Schedule 2 revenue-focused live sessions per week.'],
};

/**
 * The exact row GET /ai-algorithms/creator-analytics hands back to a member who
 * has just opened the page. The page used to be typed against a different,
 * imagined model and threw a TypeError on this payload for every single user,
 * which is why the shape is spelled out here in full rather than trimmed to the
 * fields a test happens to assert on.
 *
 * The route now recounts this row from the follow, post and video tables before
 * returning it, so the zeros below are a member with nothing published yet
 * rather than, as they used to be, every member alive.
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
  creatorTier: 'Emerging',
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
    // The endpoint no longer forecasts anything: projectedIncome is null for
    // everyone, always, and what it sends instead is the share of each gift she
    // keeps — a rate the server charges today rather than a guess at her
    // future.
    respond(NEW_CREATOR_ROW, {
      followerCount: 0,
      avgEngagementRate: null,
      creatorTier: 'Emerging',
      projectedIncome: null,
      giftRevenueShare: 70,
      nextTier: { tier: 'Rising', minFollowers: 1000, giftRevenueShare: 75 },
    });

    render(<CreatorAnalyticsPage />);

    expect(await screen.findByText(/Nothing to count yet/i)).toBeInTheDocument();
    expect(screen.getByText('Emerging')).toBeInTheDocument();
    expect(screen.getByText(/You keep 70% of every gift/i)).toBeInTheDocument();
    expect(screen.getByText(/1.0K followers moves you to Rising/i)).toBeInTheDocument();
    expect(screen.getByText(/Monetisation is not switched on/i)).toBeInTheDocument();
    expect(screen.queryByText(/Monthly income, modelled/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Conservative/i)).not.toBeInTheDocument();
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
        creatorTier: 'Rising',
        isMonetized: true,
        monetizedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        followerCount: 1240,
        avgEngagementRate: 0.082,
        creatorTier: 'Rising',
        projectedIncome: null,
        giftRevenueShare: 75,
        nextTier: { tier: 'Established', minFollowers: 10000, giftRevenueShare: 80 },
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
    expect(screen.getByText(/1,450/)).toBeInTheDocument();
    expect(screen.getByText('$128.40')).toBeInTheDocument();
    expect(screen.getByText('Rising')).toBeInTheDocument();
    expect(screen.getByText(/You keep 75% of every gift/i)).toBeInTheDocument();
    expect(screen.getByText(/Monetisation is on/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing to count yet/i)).not.toBeInTheDocument();
  });

  it('no longer reads the six fields the model never had', async () => {
    respond(NEW_CREATOR_ROW, null);

    render(<CreatorAnalyticsPage />);
    await screen.findByText(/Nothing to count yet/i);

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
