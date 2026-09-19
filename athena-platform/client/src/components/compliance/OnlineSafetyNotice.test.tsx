import { render, screen, waitFor } from '@testing-library/react';
import OnlineSafetyNotice from './OnlineSafetyNotice';

const getOnlineSafetyInfo = jest.fn();
const detectUserRegion = jest.fn();

jest.mock('@/lib/services/compliance.service', () => ({
  __esModule: true,
  default: {
    getOnlineSafetyInfo: (...args: unknown[]) => getOnlineSafetyInfo(...args),
    detectUserRegion: () => detectUserRegion(),
  },
}));

function serverAnswer(applicable: 'ANZ' | 'UK') {
  const regimes = {
    ANZ: {
      region: 'ANZ',
      act: 'Online Safety Act 2021 (Cth)',
      expectations: 'Basic Online Safety Expectations',
      regulator: {
        name: 'eSafety Commissioner',
        url: 'https://www.esafety.gov.au/',
        complaintUrl: 'https://www.esafety.gov.au/report',
        role: 'Australian online safety regulator',
      },
      reviewHours: { illegal: 24, harmful: 48 },
    },
    UK: {
      region: 'UK',
      act: 'Online Safety Act 2023',
      expectations: null,
      regulator: {
        name: 'Ofcom',
        url: 'https://www.ofcom.org.uk/',
        complaintUrl: 'https://www.ofcom.org.uk/',
        role: 'UK communications regulator',
      },
      reviewHours: { illegal: 24, harmful: 48 },
    },
  };
  return { region: applicable, applicable, regime: regimes[applicable], regimes, safetyFeatures: [] };
}

describe('OnlineSafetyNotice', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getOnlineSafetyInfo.mockReset();
    detectUserRegion.mockReset();
  });

  it('names both regimes in one sentence and links the eSafety Commissioner for an Australian reader', async () => {
    detectUserRegion.mockReturnValue('ANZ');
    getOnlineSafetyInfo.mockResolvedValue(serverAnswer('ANZ'));

    render(<OnlineSafetyNotice variant="report" />);

    expect(screen.getByText(/Online Safety Act 2021/)).toBeInTheDocument();
    expect(screen.getByText(/Online Safety Act 2023/)).toBeInTheDocument();

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /eSafety Commissioner/ });
      expect(link).toHaveAttribute('href', 'https://www.esafety.gov.au/');
    });
    expect(getOnlineSafetyInfo).toHaveBeenCalledWith('ANZ');
  });

  it('links Ofcom when the member has chosen the UK region', async () => {
    window.localStorage.setItem('athena.region', 'UK');
    detectUserRegion.mockReturnValue('ANZ');
    getOnlineSafetyInfo.mockResolvedValue(serverAnswer('UK'));

    render(<OnlineSafetyNotice variant="appeal" />);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /Ofcom/ });
      expect(link).toHaveAttribute('href', 'https://www.ofcom.org.uk/');
    });
    expect(getOnlineSafetyInfo).toHaveBeenCalledWith('UK');
  });

  it('still shows a regulator link when the server cannot be reached', async () => {
    detectUserRegion.mockReturnValue('ANZ');
    getOnlineSafetyInfo.mockRejectedValue(new Error('offline'));

    render(<OnlineSafetyNotice variant="transparency" />);

    await waitFor(() => expect(getOnlineSafetyInfo).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /eSafety Commissioner/ })).toHaveAttribute(
      'href',
      'https://www.esafety.gov.au/'
    );
  });
});
