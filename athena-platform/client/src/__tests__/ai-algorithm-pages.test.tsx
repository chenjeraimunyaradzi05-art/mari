import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MentorMatchPage from '@/app/dashboard/ai/mentors/page';
import CareerCompassPage from '@/app/dashboard/ai/career-compass/page';
import OpportunityScanPage from '@/app/dashboard/ai/opportunities/page';
import TrustScorePage from '@/app/dashboard/ai/trust/page';

/**
 * The four AI pages that used to read placeholder tables now read real
 * queries. What matters here is what they show and what they refuse to show:
 * reasons as chips and never the heuristic number, honest empty states with a
 * next step, and links to the real detail pages.
 */

jest.mock('@/lib/algorithm-api', () => ({
  algorithmApi: { mentorMatch: jest.fn(), careerCompass: jest.fn(), opportunityScan: jest.fn() },
  trustApi: { mine: jest.fn() },
}));

jest.mock('@/lib/hooks', () => ({
  useMySkills: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  aiAlgorithmsApi: { reportContent: jest.fn() },
}));

import { algorithmApi, trustApi } from '@/lib/algorithm-api';
import { useMySkills } from '@/lib/hooks';

const mockedAlgorithm = algorithmApi as unknown as {
  mentorMatch: jest.Mock;
  careerCompass: jest.Mock;
  opportunityScan: jest.Mock;
};
const mockedTrust = trustApi as unknown as { mine: jest.Mock };
const mockedSkills = useMySkills as unknown as jest.Mock;

const envelope = (data: unknown) => Promise.resolve({ data: { success: true, data } });

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const grace = {
  id: 'mentor-1',
  userId: 'mentor-user-1',
  name: 'Grace Hopper',
  avatar: null,
  headline: 'Engineering leader',
  specializations: ['product'],
  yearsExperience: 8,
  rating: 4.8,
  matchScore: 11.4,
  matchReasons: ['Shared skills: product', '8+ years experience', 'Rated 4.8'],
};

describe('Mentor Match page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSkills.mockReturnValue({ data: [{ id: 'skill-1' }] });
  });

  it('shows why each mentor is suggested as chips, never the raw score', async () => {
    mockedAlgorithm.mentorMatch.mockReturnValue(envelope({ mentors: [grace] }));
    renderWithQuery(<MentorMatchPage />);

    expect(await screen.findByText('Shared skills: product')).toBeInTheDocument();
    expect(screen.getByText('Rated 4.8')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See profile/ })).toHaveAttribute('href', '/dashboard/mentors/mentor-1');
    expect(screen.queryByText(/11\.4/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('asks her to add skills when her profile lists none, since overlap drives the order', async () => {
    mockedSkills.mockReturnValue({ data: [] });
    mockedAlgorithm.mentorMatch.mockReturnValue(envelope({ mentors: [grace] }));
    renderWithQuery(<MentorMatchPage />);

    expect(await screen.findByRole('link', { name: 'Add skills' })).toHaveAttribute('href', '/dashboard/settings/profile');
  });

  it('says so when nobody is taking mentees, with the full list as the next step', async () => {
    mockedAlgorithm.mentorMatch.mockReturnValue(envelope({ mentors: [] }));
    renderWithQuery(<MentorMatchPage />);

    expect(await screen.findByText(/No mentors are taking new mentees/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all mentors' })).toHaveAttribute('href', '/dashboard/mentors');
  });
});

const compass = {
  targetRole: 'Product designer',
  persona: null,
  skillGaps: ['figma', 'user research'],
  recommendedCourses: [{ id: 'course-1', title: 'Figma Foundations', providerName: 'TAFE Queensland', type: 'short', cost: null }],
  suggestedJobs: [{ id: 'job-1', title: 'Product Designer', organizationName: 'Acme', city: 'Brisbane', state: 'QLD', country: 'Australia' }],
};

describe('Career Compass page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the gaps, the courses that teach them and the roles, with nothing invented', async () => {
    mockedAlgorithm.careerCompass.mockReturnValue(envelope(compass));
    renderWithQuery(<CareerCompassPage />);

    expect(await screen.findByText('figma')).toBeInTheDocument();
    expect(screen.getByText('user research')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Figma Foundations/ })).toHaveAttribute('href', '/dashboard/learn/course-1');
    expect(screen.getByRole('link', { name: /Product Designer/ })).toHaveAttribute('href', '/dashboard/jobs/job-1');
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('says nothing is missing rather than inventing a forecast', async () => {
    mockedAlgorithm.careerCompass.mockReturnValue(envelope({ ...compass, skillGaps: [], recommendedCourses: [] }));
    renderWithQuery(<CareerCompassPage />);

    expect(await screen.findByText(/already on your profile/)).toBeInTheDocument();
    expect(screen.queryByText('Courses that teach them')).not.toBeInTheDocument();
  });

  it('looks up the title she types, and the profile title when the box is empty', async () => {
    mockedAlgorithm.careerCompass.mockReturnValue(envelope(compass));
    renderWithQuery(<CareerCompassPage />);
    await screen.findByText('figma');
    expect(mockedAlgorithm.careerCompass).toHaveBeenCalledWith(undefined);

    fireEvent.change(screen.getByLabelText('Role title to look at'), { target: { value: 'Data analyst' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));

    await waitFor(() => expect(mockedAlgorithm.careerCompass).toHaveBeenLastCalledWith('Data analyst'));
  });

  it('says when no active role carries that title, with a way to browse instead', async () => {
    mockedAlgorithm.careerCompass.mockReturnValue(
      envelope({ ...compass, targetRole: 'Astronaut', skillGaps: [], recommendedCourses: [], suggestedJobs: [] })
    );
    renderWithQuery(<CareerCompassPage />);

    expect(await screen.findByText(/No active roles titled/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse roles' })).toHaveAttribute('href', '/dashboard/jobs');
  });
});

describe('What is new page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the newest listings in three rails and says they are not a match', async () => {
    mockedAlgorithm.opportunityScan.mockReturnValue(
      envelope({
        jobs: [{ id: 'job-1', title: 'Analyst', organizationName: 'Org', city: null, state: null, country: 'Australia' }],
        courses: [{ id: 'course-1', title: 'Data 101', providerName: 'TAFE', type: 'certificate' }],
        events: [{ id: 'event-1', title: 'Career Fair', date: '2099-03-01T00:00:00.000Z', location: 'Brisbane', isFeatured: false }],
      })
    );
    renderWithQuery(<OpportunityScanPage />);

    expect(await screen.findByText('Career Fair')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Analyst/ })).toHaveAttribute('href', '/dashboard/jobs/job-1');
    expect(screen.getByRole('link', { name: /Data 101/ })).toHaveAttribute('href', '/dashboard/learn/course-1');
    expect(screen.getByText(/not a match to your profile/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Opportunity Radar' })).toHaveAttribute('href', '/dashboard/ai/opportunity-radar');
    expect(screen.queryByRole('button', { name: /Interested/ })).not.toBeInTheDocument();
  });

  it('calls a quiet week a quiet week', async () => {
    mockedAlgorithm.opportunityScan.mockReturnValue(envelope({ jobs: [], courses: [], events: [] }));
    renderWithQuery(<OpportunityScanPage />);

    expect(await screen.findByText('A quiet week')).toBeInTheDocument();
  });
});

describe('Trust page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the factors earned with their points, and a next step for each one not yet earned', async () => {
    mockedTrust.mine.mockReturnValue(
      envelope({
        score: 65,
        factors: [
          { label: 'Email verified', points: 10 },
          { label: 'LinkedIn connected', points: 5 },
        ],
        updatedAt: '2026-09-19T00:00:00.000Z',
      })
    );
    renderWithQuery(<TrustScorePage />);

    expect(await screen.findByText('+10')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Trust score 65 out of 100' })).toBeInTheDocument();
    // Earned once, in the earned list, and not offered again as a step.
    expect(screen.getAllByText('Email verified')).toHaveLength(1);
    expect(screen.getByText('Verification badges')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Verification/ })).toHaveAttribute('href', '/dashboard/settings/verification');
    expect(screen.getByRole('link', { name: /Your referral link/ })).toHaveAttribute('href', '/dashboard/referrals');
  });

  it('names the suspension and the way to raise it', async () => {
    mockedTrust.mine.mockReturnValue(
      envelope({ score: 10, factors: [{ label: 'Account suspension', points: -40 }], updatedAt: '2026-09-19T00:00:00.000Z' })
    );
    renderWithQuery(<TrustScorePage />);

    expect(await screen.findByText('Your account is suspended')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get in touch' })).toHaveAttribute('href', '/dashboard/settings/help');
  });
});
