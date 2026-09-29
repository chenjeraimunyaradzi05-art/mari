import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Privacy impact assessments.
 *
 * They could only be written with curl, so none were. These tests hold the
 * screen to writing one with its risks and measures in the shape the server
 * keeps, refusing to approve one left at high risk until the risk is accepted
 * on the record, sending a changed approved assessment back for sign-off, and
 * never reading a failed load as "no assessments".
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));

import ImpactAssessmentsPage from './page';
import { api } from '@/lib/api';

const apiMock = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock };

const assessment = (overrides: Record<string, unknown> = {}) => ({
  id: 'dpia-1',
  title: 'Safety score',
  description: 'Scores accounts for signs of harassment.',
  featureOrSystem: 'SafetyScore',
  dataCategories: ['BEHAVIORAL'],
  processingOperations: ['Signals read', 'Score stored'],
  necessity: 'Harassment is the harm the platform exists to prevent.',
  proportionality: 'Only signals moderators can already see.',
  risks: [{ description: 'A survivor is scored as the aggressor', likelihood: 'MEDIUM', impact: 'HIGH', score: 6 }],
  mitigations: [{ measure: 'A person reviews every critical score', status: 'IN_PLACE', risk: 'A survivor is scored as the aggressor', owner: 'T&S' }],
  residualRiskLevel: 'HIGH',
  residualRiskAccepted: false,
  dpoConsulted: false,
  dpoComments: null,
  regulatorConsulted: false,
  regulatorResponse: null,
  status: 'PENDING_REVIEW',
  approvedBy: null,
  approvedAt: null,
  approvedByName: null,
  nextReviewDate: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

const paged = (rows: unknown[]) => ({ data: { success: true, data: rows, pagination: { page: 1, limit: 50, total: rows.length, pages: 1, hasMore: false } } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ImpactAssessmentsPage />
    </QueryClientProvider>
  );
}

describe('Privacy impact assessments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiMock.get.mockResolvedValue(paged([assessment()]));
  });

  it('will not approve an assessment left at high risk until the risk is accepted', async () => {
    apiMock.patch.mockResolvedValue({ data: { success: true, data: assessment({ status: 'APPROVED' }) } });
    renderPage();

    fireEvent.click(await screen.findByText('Safety score'));
    const panel = await screen.findByRole('complementary', { name: 'Impact assessment' });
    const approve = within(panel).getByRole('button', { name: 'Approve' });
    expect(approve).toBeDisabled();

    fireEvent.click(within(panel).getByText(/I accept the high risk that is left/));
    fireEvent.click(approve);

    await waitFor(() =>
      expect(apiMock.patch).toHaveBeenCalledWith('/gdpr/dpia/dpia-1', expect.objectContaining({ status: 'APPROVED', residualRiskAccepted: true }))
    );
  });

  it('shows the risks with their scores, highest first', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('Safety score'));
    const panel = await screen.findByRole('complementary', { name: 'Impact assessment' });
    expect(within(panel).getByText('6 / 9')).toBeInTheDocument();
    expect(within(panel).getByText(/answers “A survivor is scored as the aggressor”/)).toBeInTheDocument();
  });

  it('starts an assessment with its risks and measures in the shape the server keeps', async () => {
    apiMock.post.mockResolvedValue({ data: { success: true, data: assessment({ id: 'dpia-2', status: 'DRAFT' }) } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Start an assessment/ }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Safe chat' } });
    fireEvent.change(screen.getByLabelText('Feature or system'), { target: { value: 'DV safe chat' } });
    fireEvent.change(screen.getByLabelText('What it does with personal information'), { target: { value: 'Stores messages between a survivor and support.' } });
    fireEvent.change(screen.getByLabelText('Why it is necessary'), { target: { value: 'Support has to reach her.' } });
    fireEvent.change(screen.getByLabelText('Why it is proportionate'), { target: { value: 'Only the two parties can read it.' } });
    fireEvent.click(screen.getByRole('button', { name: /Add a risk/ }));
    fireEvent.change(screen.getByLabelText('Risk 1'), { target: { value: 'The abuser finds the chat on her phone' } });
    fireEvent.change(screen.getByLabelText('Risk 1 impact'), { target: { value: 'HIGH' } });
    fireEvent.click(screen.getByRole('button', { name: /Add a measure/ }));
    fireEvent.change(screen.getByLabelText('Measure 1'), { target: { value: 'PIN lock and quick exit' } });
    fireEvent.change(screen.getByLabelText('Measure 1 answers'), { target: { value: 'The abuser finds the chat on her phone' } });
    fireEvent.change(screen.getByLabelText('Risk left once the measures are in place'), { target: { value: 'MEDIUM' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start as a draft' }));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    const [url, body] = apiMock.post.mock.calls[0];
    expect(url).toBe('/gdpr/dpia');
    expect(body.risks).toEqual([{ description: 'The abuser finds the chat on her phone', likelihood: 'MEDIUM', impact: 'HIGH' }]);
    expect(body.mitigations).toEqual([
      { measure: 'PIN lock and quick exit', status: 'PLANNED', risk: 'The abuser finds the chat on her phone', owner: null },
    ]);
    expect(body.residualRiskLevel).toBe('MEDIUM');
  });

  it('sends a changed approved assessment back for sign-off', async () => {
    apiMock.get.mockResolvedValue(paged([assessment({ status: 'APPROVED', residualRiskAccepted: true, approvedAt: '2026-09-10T00:00:00.000Z', approvedByName: 'Mere' })]));
    apiMock.patch.mockResolvedValue({ data: { success: true, data: assessment() } });
    renderPage();

    fireEvent.click(await screen.findByText('Safety score'));
    const panel = await screen.findByRole('complementary', { name: 'Impact assessment' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/Saving a change sends it back for sign-off/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith('/gdpr/dpia/dpia-1', expect.objectContaining({ status: 'PENDING_REVIEW' })));
  });

  it('counts risks it cannot read instead of hiding them', async () => {
    apiMock.get.mockResolvedValue(paged([assessment({ risks: [3, { description: 'Readable', likelihood: 'LOW', impact: 'LOW' }] })]));
    renderPage();

    fireEvent.click(await screen.findByText('Safety score'));
    const panel = await screen.findByRole('complementary', { name: 'Impact assessment' });
    expect(within(panel).getByText('1 more recorded in a form this screen cannot read.')).toBeInTheDocument();
  });

  it('says the assessments failed to load rather than that there are none', async () => {
    apiMock.get.mockRejectedValue({ response: { data: { message: 'Forbidden' } } });
    renderPage();

    expect(await screen.findByText('The assessments could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/No assessment has been written yet/)).not.toBeInTheDocument();
  });
});
