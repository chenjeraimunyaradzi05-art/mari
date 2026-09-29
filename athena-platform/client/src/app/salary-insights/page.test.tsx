import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SalaryInsightsPage from './page';

/**
 * What the salary page says about a pay gap and about its own floors.
 *
 * The gap sentence read "the median for men sits N% above the median for
 * women" whatever the sign, so a gap in women's favour was described as one
 * against them, with a minus sign in the dollar figure. And the page told
 * members a gap needed "three women and three men", two floors behind the
 * server's ten of each.
 */

jest.mock('@/lib/store', () => ({
  useAuthStore: (select: (state: { isAuthenticated: boolean; isLoading: boolean }) => unknown) =>
    select({ isAuthenticated: true, isLoading: false }),
}));

jest.mock('@/lib/api', () => ({
  aiAlgorithmsApi: {
    analyzeSalary: jest.fn(),
    getMySalaryAnalyses: jest.fn(),
    submitSalaryData: jest.fn(),
  },
}));

jest.mock('@/lib/algorithm-api', () => ({
  algorithmApi: { salaryEquity: jest.fn() },
  salaryApi: { negotiationScript: jest.fn() },
}));

import { aiAlgorithmsApi } from '@/lib/api';
import { algorithmApi } from '@/lib/algorithm-api';

const ai = aiAlgorithmsApi as unknown as Record<string, jest.Mock>;
const algorithms = algorithmApi as unknown as Record<string, jest.Mock>;

const ANALYSIS = {
  id: 'an-1',
  targetRole: 'Electrician',
  targetLocation: null,
  marketMedian: 90000,
  sampleSize: 24,
  salaryBands: { p10: null, p25: 82000, p50: 90000, p75: 99000, p90: null },
};

function lookUp() {
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Electrician' } });
  fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
}

describe('Salary insights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ai.getMySalaryAnalyses.mockResolvedValue({ data: { data: [] } });
    algorithms.salaryEquity.mockResolvedValue({ data: { data: { marketMedian: null, sampleSize: 0, targetRole: 'Electrician' } } });
  });

  it('describes a gap in women’s favour as one, without a minus sign', async () => {
    ai.analyzeSalary.mockResolvedValue({
      data: { data: { ...ANALYSIS, genderGapAmount: -4000, genderGapPercent: -4.3 }, genderGapWithheld: null, bandWithheld: null },
    });
    render(<SalaryInsightsPage />);

    lookUp();

    expect(await screen.findByText(/sits 4\.3% \(\$4,000\) below the median for women/)).toBeInTheDocument();
    expect(screen.queryByText(/-\$4,000/)).not.toBeInTheDocument();
  });

  it('describes a gap against women as above', async () => {
    ai.analyzeSalary.mockResolvedValue({
      data: { data: { ...ANALYSIS, genderGapAmount: 7000, genderGapPercent: 7.2 }, genderGapWithheld: null, bandWithheld: null },
    });
    render(<SalaryInsightsPage />);

    lookUp();

    expect(await screen.findByText(/sits 7\.2% \(\$7,000\) above the median for women/)).toBeInTheDocument();
  });

  it('gives the server’s own reason a gap is withheld, and never the old floor', async () => {
    ai.analyzeSalary.mockResolvedValue({
      data: {
        data: { ...ANALYSIS, genderGapAmount: null, genderGapPercent: null },
        genderGapWithheld: 'A gender pay gap is published only once at least 10 women and 10 men have reported pay for this role.',
        bandWithheld: null,
      },
    });
    render(<SalaryInsightsPage />);

    lookUp();

    expect(await screen.findByText(/at least 10 women and 10 men have reported pay/)).toBeInTheDocument();
    expect(screen.queryByText(/three women and three men/)).not.toBeInTheDocument();
  });

  it('says what the server said when there is too little to publish', async () => {
    ai.analyzeSalary.mockResolvedValue({
      data: {
        data: null,
        message: 'Not enough members have reported pay for this role yet. A median is published once 10 people have reported in AUD.',
      },
    });
    render(<SalaryInsightsPage />);

    lookUp();

    expect(await screen.findByText(/A median is published once 10 people have reported in AUD/)).toBeInTheDocument();
  });
});
