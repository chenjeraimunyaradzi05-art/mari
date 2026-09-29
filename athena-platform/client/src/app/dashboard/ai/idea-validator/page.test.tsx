import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * ATHENA keeps no idea assessment, so the page hands her a copy — and only of
 * an assessment that exists. When no model ran there is nothing to keep, and a
 * file saying so would be a receipt for nothing.
 */

const SCORED = {
  overallScore: 71,
  marketPotential: { score: 68, analysis: 'Demand is local and steady.' },
  feasibility: { score: 74 },
  competition: { score: 55, analysis: 'Two charities do this in Brisbane.', competitors: ['Dress for Success'] },
  targetAudience: { description: 'Women returning to work', size: null, demographics: [] },
  strengths: ['Low stock cost'],
  weaknesses: ['Seasonal demand'],
  recommendations: ['Partner with a job agency'],
  nextSteps: ['Run a pop-up'],
  simulated: false,
};

const mockMutate = jest.fn();
jest.mock('@/lib/hooks', () => ({
  useIdeaValidator: () => ({ mutate: mockMutate, isPending: false }),
}));

jest.mock('@/lib/download', () => ({
  downloadText: jest.fn(),
}));

jest.mock('../PremiumGate', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import IdeaValidatorPage from './page';
import { downloadText } from '@/lib/download';

const download = downloadText as unknown as jest.Mock;

function validate(response: unknown) {
  mockMutate.mockImplementation((_vars: unknown, opts: { onSuccess: (data: unknown) => void }) => opts.onSuccess(response));
  render(<IdeaValidatorPage />);
  fireEvent.change(screen.getByPlaceholderText(/Describe your idea in detail/), {
    target: { value: 'A lending library for interview workwear.' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Validate Idea/ }));
}

describe('Idea validator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('says before she submits that the idea is not kept', () => {
    render(<IdeaValidatorPage />);
    expect(screen.getByText(/ATHENA keeps neither the idea nor the assessment/)).toBeInTheDocument();
  });

  it('saves her idea and the assessment as text', async () => {
    validate(SCORED);
    expect(await screen.findByText('Overall Viability Score')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save a copy/ }));

    const [filename, text] = download.mock.calls[0];
    expect(filename).toMatch(/^athena-idea-assessment-\d{4}-\d{2}-\d{2}\.txt$/);
    expect(text).toContain('A lending library for interview workwear.');
    expect(text).toContain('Category: Startup/Business');
    expect(text).toContain('Overall: 71/100');
    expect(text).toContain('Named: Dress for Success');
    expect(text).toContain('• Run a pop-up');
  });

  it('offers nothing to save when no model read the idea', async () => {
    validate({ overallScore: null, analysis: null, simulated: true });
    expect(await screen.findByText('No assessment was made')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save a copy/ })).not.toBeInTheDocument();
  });

  it('saves a prose-only assessment too', async () => {
    validate({ analysis: 'A promising service with a clear audience.', simulated: false });
    expect(await screen.findByText('A promising service with a clear audience.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save a copy/ }));
    expect(download.mock.calls[0][1]).toContain('Analysis\n--------\nA promising service with a clear audience.');
  });
});
