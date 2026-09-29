import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The record of processing activities.
 *
 * The API was complete and nothing called it, so the record a regulator asks
 * for first was one nobody kept. These tests hold the screen to recording an
 * activity in full, amending it without silently keeping what was cleared,
 * flagging an activity that needs an assessment and has none, retiring rather
 * than deleting, and never showing a failed load as an empty record.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

import ProcessingRegisterPage from './page';
import { api } from '@/lib/api';

const apiMock = api as unknown as { get: jest.Mock; post: jest.Mock; patch: jest.Mock; delete: jest.Mock };

const activity = (overrides: Record<string, unknown> = {}) => ({
  id: 'ropa-1',
  name: 'Safety plan storage',
  description: 'Members keep a safety plan; it is stored encrypted.',
  department: 'Trust & Safety',
  dataSubjectCategories: ['Members'],
  dataCategories: ['SENSITIVE'],
  dataElements: ['Safe contacts'],
  legalBasis: 'CONSENT',
  legalBasisDetails: null,
  purposes: ['Help a member leave safely'],
  recipients: [],
  thirdCountryTransfers: ['United States'],
  transferSafeguards: 'APP 8 contract terms with the host',
  retentionPeriod: 'Until she deletes it',
  retentionJustification: null,
  securityMeasures: ['Encrypted at rest'],
  dpiaRequired: true,
  dpiaId: null,
  subprocessors: [],
  isActive: true,
  lastReviewDate: null,
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
      <ProcessingRegisterPage />
    </QueryClientProvider>
  );
}

describe('Record of processing activities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/gdpr/ropa') return paged([activity()]);
      if (url === '/gdpr/dpia') return paged([{ id: 'dpia-1', title: 'Safety plans', status: 'APPROVED', featureOrSystem: 'Safety plans' }]);
      throw new Error(`unexpected ${url}`);
    });
  });

  it('flags an activity that needs an assessment and has none linked', async () => {
    renderPage();

    expect(await screen.findByText('Safety plan storage')).toBeInTheDocument();
    expect(screen.getByText('Assessment needed, none linked')).toBeInTheDocument();
    expect(screen.getByText(/Never reviewed/)).toBeInTheDocument();
  });

  it('records a new activity with its lists split into entries', async () => {
    apiMock.post.mockResolvedValue({ data: { success: true, data: activity({ id: 'ropa-2' }) } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Record an activity/ }));
    const record = screen.getByRole('button', { name: 'Record the activity' });
    expect(record).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mentor matching' } });
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 'Careers' } });
    fireEvent.change(screen.getByLabelText('What is done with the information'), { target: { value: 'Matches members with mentors.' } });
    fireEvent.change(screen.getByLabelText('The basis it rests on'), { target: { value: 'CONTRACT' } });
    fireEvent.change(screen.getByLabelText('How long it is kept'), { target: { value: 'While the match is active' } });
    fireEvent.change(screen.getByLabelText('Purposes'), { target: { value: 'Find a mentor\n\nKeep the match going' } });
    fireEvent.click(screen.getByText('Identity and contact details'));
    fireEvent.click(record);

    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    const [url, body] = apiMock.post.mock.calls[0];
    expect(url).toBe('/gdpr/ropa');
    expect(body).toMatchObject({
      name: 'Mentor matching',
      department: 'Careers',
      legalBasis: 'CONTRACT',
      retentionPeriod: 'While the match is active',
      purposes: ['Find a mentor', 'Keep the match going'],
      dataCategories: ['PII'],
      dpiaRequired: false,
    });
    // A new record leaves out what was not filled in rather than sending nulls:
    // what goes over the wire is the JSON, and undefined never reaches it.
    const sent = JSON.parse(JSON.stringify(body));
    expect(sent).not.toHaveProperty('dpiaId');
    expect(sent).not.toHaveProperty('transferSafeguards');
  });

  it('clears a field that was emptied in an amendment, instead of keeping it', async () => {
    apiMock.patch.mockResolvedValue({ data: { success: true, data: activity() } });
    renderPage();

    fireEvent.click(await screen.findByText('Safety plan storage'));
    const panel = await screen.findByRole('complementary', { name: 'Processing activity' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Amend' }));

    fireEvent.change(screen.getByLabelText('Countries it goes to outside Australia'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('The assessment behind it'), { target: { value: 'dpia-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the amendment' }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledTimes(1));
    const [url, body] = apiMock.patch.mock.calls[0];
    expect(url).toBe('/gdpr/ropa/ropa-1');
    expect(body).toMatchObject({ thirdCountryTransfers: [], transferSafeguards: null, dpiaId: 'dpia-1', nextReviewDate: null });
  });

  it('records a review by the server’s clock, and retires rather than deletes', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    apiMock.patch.mockResolvedValue({ data: { success: true, data: activity() } });
    apiMock.delete.mockResolvedValue({ data: { success: true, data: activity({ isActive: false }) } });
    renderPage();

    fireEvent.click(await screen.findByText('Safety plan storage'));
    const panel = await screen.findByRole('complementary', { name: 'Processing activity' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Reviewed today' }));
    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith('/gdpr/ropa/ropa-1', { reviewed: true }));

    fireEvent.click(within(panel).getByRole('button', { name: 'Retire' }));
    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith('/gdpr/ropa/ropa-1'));
    confirm.mockRestore();
  });

  it('says the record failed to load rather than showing an empty one', async () => {
    apiMock.get.mockRejectedValue({ response: { data: { message: 'Forbidden' } } });
    renderPage();

    expect(await screen.findByText('The record could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/No processing activity is recorded yet/)).not.toBeInTheDocument();
  });
});
