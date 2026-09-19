import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MigrantPage from '@/app/dashboard/impact/migrant/page';

jest.mock('@/lib/api', () => ({
  communitySupportApi: {
    getLanguageProfile: jest.fn(),
    getCredentials: jest.fn(),
    getBridgingPrograms: jest.fn(),
    saveLanguageProfile: jest.fn(),
    addCredential: jest.fn(),
  },
  courseApi: { getAll: jest.fn() },
}));

jest.mock('@/lib/impact-api', () => ({
  credentialPathwayApi: { pathway: jest.fn(), recordOutcome: jest.fn() },
}));

import { communitySupportApi, courseApi } from '@/lib/api';
import { credentialPathwayApi } from '@/lib/impact-api';

const support = communitySupportApi as unknown as Record<string, jest.Mock>;
const courses = courseApi as unknown as { getAll: jest.Mock };
const pathwayApi = credentialPathwayApi as unknown as { pathway: jest.Mock; recordOutcome: jest.Mock };

const ok = <T,>(data: T) => Promise.resolve({ data: { success: true, data } });

const AMEP = {
  name: 'Adult Migrant English Program',
  shortName: 'AMEP',
  provider: 'Australian Government, Department of Home Affairs',
  cost: 'Free',
  url: 'https://immi.homeaffairs.gov.au/settling-in-australia/amep/about-the-program',
  summary: 'Free English classes for eligible migrants.',
  eligibility: 'Eligible visa holders without vocational English.',
  forProficiency: 'BEGINNER',
};

const ANMAC = {
  matched: true,
  profession: { id: 'nursing', label: 'Nursing and midwifery' },
  body: { name: 'Australian Nursing and Midwifery Accreditation Council (ANMAC)', url: 'https://www.anmac.org.au', role: 'skills assessment' },
  also: [{ name: 'Nursing and Midwifery Board of Australia (through Ahpra)', url: 'https://www.ahpra.gov.au', role: 'registration' }],
  note: 'ANMAC assesses the qualification for migration.',
};

const nursingCredential = {
  id: 'cred-1',
  originalCountry: 'Philippines',
  credentialType: 'DEGREE',
  credentialName: 'Bachelor of Science in Nursing',
  institution: 'University of Santo Tomas',
  yearObtained: 2015,
  fieldOfStudy: 'Nursing',
  status: 'PENDING_REVIEW',
  australianEquiv: null,
  bridgingRequired: null,
  assessmentBody: null,
  assessmentDate: null,
  notes: null,
};

function arrange({ english = 'BEGINNER', credentials = [nursingCredential] as Array<typeof nursingCredential> } = {}) {
  support.getLanguageProfile.mockImplementation(() => ok({ id: 'lp', primaryLanguage: 'Tagalog', primaryProficiency: 'NATIVE', englishProficiency: english, needsInterpreter: false }));
  support.getCredentials.mockImplementation(() => ok(credentials));
  support.getBridgingPrograms.mockImplementation(() => ok([]));
  courses.getAll.mockImplementation(() => ok([]));
  pathwayApi.pathway.mockImplementation(() =>
    ok({
      asAt: 'links checked 19 September 2026',
      pathway: ANMAC,
      bridgingPrograms: [{ id: 'bp-1', name: 'IRON program', provider: 'TAFE Queensland', profession: 'nursing', fundingAvailable: true, url: 'https://tafeqld.edu.au' }],
      englishSupport: ['NONE', 'BEGINNER', 'INTERMEDIATE'].includes(english) ? { ...AMEP, forProficiency: english } : null,
    })
  );
  pathwayApi.recordOutcome.mockImplementation(() => ok({ ...nursingCredential, status: 'RECOGNIZED' }));
}

describe('migrant page: credential pathway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('names the assessing body and the matching bridging program for a nursing degree', async () => {
    arrange();
    render(<MigrantPage />);

    expect(await screen.findByText(/the body to ask is/i)).toBeInTheDocument();
    const anmac = screen.getByRole('link', { name: /ANMAC/ });
    expect(anmac).toHaveAttribute('href', 'https://www.anmac.org.au');
    expect(screen.getByRole('link', { name: 'IRON program' })).toHaveAttribute('href', 'https://tafeqld.edu.au');
    expect(pathwayApi.pathway).toHaveBeenCalledWith({ credentialId: 'cred-1' });
  });

  it('offers the free Adult Migrant English Program below vocational English, and not above it', async () => {
    arrange({ english: 'BEGINNER' });
    const { unmount } = render(<MigrantPage />);
    expect(await screen.findByText('Adult Migrant English Program')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find an AMEP provider/ })).toHaveAttribute('href', AMEP.url);
    await waitFor(() => expect(courses.getAll).toHaveBeenCalledWith({ search: 'English', limit: 4 }));
    expect(await screen.findByText(/None listed yet/)).toBeInTheDocument();
    unmount();

    jest.clearAllMocks();
    arrange({ english: 'FLUENT' });
    render(<MigrantPage />);
    await screen.findByText(/the body to ask is/i);
    expect(screen.queryByText('Adult Migrant English Program')).not.toBeInTheDocument();
    expect(courses.getAll).not.toHaveBeenCalled();
  });

  it('lets her record what the assessing body said, prefilled with the suggested body', async () => {
    arrange();
    render(<MigrantPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Record what they said/ }));

    const body = screen.getByLabelText('Assessing body') as HTMLInputElement;
    expect(body.value).toBe(ANMAC.body.name);
    fireEvent.change(screen.getByLabelText('What they decided'), { target: { value: 'RECOGNIZED' } });
    fireEvent.change(screen.getByLabelText('Australian equivalent they named'), { target: { value: 'Bachelor of Nursing' } });
    fireEvent.change(screen.getByLabelText('Date of their letter'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(pathwayApi.recordOutcome).toHaveBeenCalledWith('cred-1', {
        status: 'RECOGNIZED',
        australianEquiv: 'Bachelor of Nursing',
        bridgingRequired: null,
        assessmentBody: ANMAC.body.name,
        assessmentDate: '2026-09-01',
        notes: null,
      })
    );
    // The page reloads her credentials afterwards.
    await waitFor(() => expect(support.getCredentials).toHaveBeenCalledTimes(2));
  });
});
