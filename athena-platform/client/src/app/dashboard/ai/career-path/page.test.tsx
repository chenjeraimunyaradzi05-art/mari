import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The plan view printed "7-10 Years to Goal", "+3x Salary Growth" and "12+
 * Skills to Master" over every plan for every member, beside three fixed
 * "next steps", while the advice the model actually wrote was dropped. These
 * guard the view drawing only what the plan contains.
 */

const PLAN = {
  currentLevel: 'Mid-level analyst',
  targetLevel: 'Analytics lead',
  matchScore: null,
  milestones: [
    { timeframe: '0-6 months', title: 'Own a reporting stream', description: 'Take one report end to end.', skillsToAcquire: ['SQL', 'Stakeholder management'] },
    { timeframe: '6-18 months', title: 'Lead a small team', description: 'Supervise two analysts.', skillsToAcquire: ['sql', 'Coaching'] },
  ],
  recommendedRoles: ['Analytics Lead'],
  learningPath: ['Data leadership short course'],
  careerAdvice: 'Put your name on the reports you already carry.',
  simulated: false,
};

const mockMutate = jest.fn();
jest.mock('@/lib/hooks', () => ({
  useGenerateCareerPath: () => ({ mutate: mockMutate, isPending: false }),
}));

jest.mock('@/lib/api', () => ({
  aiApi: { careerPath: jest.fn() },
}));

jest.mock('../PremiumGate', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import CareerPathPage from './page';
import { aiApi } from '@/lib/api';

const careerPath = aiApi.careerPath as unknown as jest.Mock;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CareerPathPage />
    </QueryClientProvider>
  );
}

describe('Career path planner', () => {
  beforeEach(() => jest.clearAllMocks());

  it('draws the plan it was given and none of the old constants', async () => {
    mockMutate.mockImplementation((_vars: unknown, opts: { onSuccess: (data: unknown) => void }) => opts.onSuccess(PLAN));
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/Marketing Coordinator/), { target: { value: 'Analyst' } });
    fireEvent.change(screen.getByPlaceholderText(/VP of Product/), { target: { value: 'Analytics Lead' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Career Path/ }));

    expect(await screen.findByText('Own a reporting stream')).toBeInTheDocument();
    expect(screen.getByText('Put your name on the reports you already carry.')).toBeInTheDocument();
    expect(screen.getByText('Data leadership short course')).toBeInTheDocument();
    // Three distinct skills: "SQL" and "sql" are one.
    expect(screen.getByText('Skills named').previousSibling).toHaveTextContent('3');
    expect(screen.getByText('No readiness estimate given')).toBeInTheDocument();

    for (const constant of ['7-10', '+3x', '12+', 'Develop leadership skills']) {
      expect(screen.queryByText(constant)).not.toBeInTheDocument();
    }
  });

  it('plans from her profile through GET /ai/career-path', async () => {
    careerPath.mockResolvedValue({ data: { success: true, data: { ...PLAN, currentProfile: { headline: 'Data Analyst' } } } });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Plan from my profile/ }));

    expect(await screen.findByText('Lead a small team')).toBeInTheDocument();
    expect(careerPath).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Data Analyst → Analytics lead/)).toBeInTheDocument();
  });

  it('draws no plan when the planner has no model behind it', async () => {
    mockMutate.mockImplementation((_vars: unknown, opts: { onSuccess: (data: unknown) => void }) =>
      opts.onSuccess({ ...PLAN, milestones: [], simulated: true })
    );
    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/Marketing Coordinator/), { target: { value: 'Analyst' } });
    fireEvent.change(screen.getByPlaceholderText(/VP of Product/), { target: { value: 'Analytics Lead' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Career Path/ }));

    expect(await screen.findByText(/not connected to its AI model/)).toBeInTheDocument();
    expect(screen.queryByText('Your Career Path')).not.toBeInTheDocument();
  });
});
