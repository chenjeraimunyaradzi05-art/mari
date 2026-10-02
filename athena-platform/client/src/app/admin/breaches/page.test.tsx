import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Telling the people affected by a breach.
 *
 * Some of them use Safe Mode or have reported someone to us, and may share a
 * phone or an inbox with that person. An email saying their data was exposed
 * can be the harm, so those members are told in the app only unless privacy
 * counsel has approved an email. These tests hold the screen to saying how the
 * list divides before anything is sent, to refusing to send without that
 * answer, and to asking for counsel's word and a neutral subject before it will
 * ask the server to email them.
 */

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

import BreachRegisterPage from './page';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

const apiMock = api as unknown as { get: jest.Mock; post: jest.Mock };
const toastMock = toast as unknown as { success: jest.Mock; error: jest.Mock };

const breach = {
  id: 'breach-1',
  title: 'Exported CV bucket left public',
  description: 'A storage bucket was readable without credentials.',
  detectedAt: '2026-09-17T00:00:00.000Z',
  occurredAt: null,
  severity: 'HIGH',
  status: 'INVESTIGATING',
  dataCategories: ['PII'],
  affectedRecords: null,
  affectedUsers: 2,
  riskToIndividuals: 'Names and employment history were readable.',
  notificationRequired: false,
  regulatorNotifiedAt: null,
  regulatorReference: null,
  usersNotifiedAt: null,
  containmentActions: [],
  remediationActions: [],
  rootCause: null,
  notificationDeadline: { deadlineAt: null, hoursRemaining: null, state: 'NOT_APPLICABLE' },
  jurisdiction: 'AU',
  jurisdictions: ['AU'],
  assessmentDueAt: '2026-10-17T00:00:00.000Z',
  assessmentComplete: true,
  seriousHarmLikely: true,
  remediedBeforeHarm: false,
  statementEntityContact: null,
  statementDescription: null,
  statementInformationKinds: [],
  statementRecommendedSteps: 'Change your password and watch for unexpected contact.',
  statementLodgedAt: null,
};

const split = { requested: 2, found: 2, safetyMembers: 1, ordinaryMembers: 1 };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BreachRegisterPage />
    </QueryClientProvider>
  );
}

async function openForm() {
  renderPage();
  fireEvent.click(await screen.findByText('Exported CV bucket left public'));
  return screen.findByLabelText('Member ids to notify');
}

const sendButton = () => screen.getByRole('button', { name: /^Notify/ });
const notifyCall = () => apiMock.post.mock.calls.find((call) => String(call[0]).endsWith('/notify-users'));

describe('Telling the people affected', () => {
  let confirm: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/admin/breaches') return { data: { breaches: [breach], summary: { total: 1, overdue: 0, dueWithin24Hours: 0, notifiedLate: 0 } } };
      if (url === '/admin/breaches/ndb-assessments-due') return { data: { breaches: [] } };
      throw new Error(`unexpected ${url}`);
    });
    apiMock.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/notify-users/preview')) return { data: { success: true, ...split } };
      if (url.endsWith('/notify-users')) {
        return { data: { success: true, requested: 2, emailed: 1, inApp: 1, safetyMembersInAppOnly: 1, failedUserIds: [] } };
      }
      throw new Error(`unexpected ${url}`);
    });
  });

  afterEach(() => confirm.mockRestore());

  it('says how the list divides before anything is sent, and will not send until it has been told', async () => {
    const ids = await openForm();
    fireEvent.change(screen.getByLabelText('What happened, in the words they will read'), { target: { value: 'Some details were readable for six hours.' } });
    fireEvent.change(ids, { target: { value: 'user-ordinary\nuser-safe' } });

    // Until the server has answered for this list, the button is shut.
    expect(sendButton()).toBeDisabled();

    expect(await screen.findByText(/1 will be emailed/)).toBeInTheDocument();
    expect(screen.getByText(/uses Safe Mode or has reported someone to us/)).toBeInTheDocument();
    expect(screen.getByText(/told in the app only, under a neutral title, and not emailed/)).toBeInTheDocument();
    expect(apiMock.post).toHaveBeenCalledWith('/admin/breaches/breach-1/notify-users/preview', { userIds: ['user-ordinary', 'user-safe'] });
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(notifyCall()).toBeUndefined();
  });

  it('asks the server to tell the safety group in the app only, and says nothing about emailing them', async () => {
    const ids = await openForm();
    fireEvent.change(screen.getByLabelText('What happened, in the words they will read'), { target: { value: 'Some details were readable for six hours.' } });
    fireEvent.change(ids, { target: { value: 'user-ordinary, user-safe' } });
    await screen.findByText(/1 will be emailed/);
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.click(sendButton());

    await waitFor(() => expect(notifyCall()).toBeDefined());
    const body = notifyCall()![1];
    expect(body).toEqual({
      userIds: ['user-ordinary', 'user-safe'],
      notificationContent: 'Some details were readable for six hours.',
      recommendedSteps: 'Change your password and watch for unexpected contact.',
    });
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Email 1 person and tell 1 in the app/));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('1 emailed, 1 told in the app.'));
  });

  it('sends the neutral wording for them when it is written, and only for them', async () => {
    const ids = await openForm();
    fireEvent.change(screen.getByLabelText('What happened, in the words they will read'), { target: { value: 'Your reports were exposed.' } });
    fireEvent.change(ids, { target: { value: 'user-ordinary user-safe' } });
    fireEvent.change(await screen.findByLabelText('Neutral wording for them (optional)'), {
      target: { value: 'We fixed a problem that may have let some account details be read.' },
    });
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.click(sendButton());

    await waitFor(() => expect(notifyCall()).toBeDefined());
    expect(notifyCall()![1]).toMatchObject({
      notificationContent: 'Your reports were exposed.',
      safetyNotificationContent: 'We fixed a problem that may have let some account details be read.',
    });
  });

  it('will not offer to email them until counsel is ticked and a subject is given, then sends both', async () => {
    const ids = await openForm();
    fireEvent.change(screen.getByLabelText('What happened, in the words they will read'), { target: { value: 'Some details were readable.' } });
    fireEvent.change(ids, { target: { value: 'user-ordinary user-safe' } });
    await screen.findByText(/1 will be emailed/);
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.click(screen.getByLabelText('Email them as well as telling them in the app'));
    expect(screen.getByText(/told in the app and emailed under the subject counsel approved/)).toBeInTheDocument();
    // Ticked, but no counsel and no subject yet.
    expect(sendButton()).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Privacy counsel has approved this wording and emailing these members'));
    expect(sendButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('The neutral subject counsel approved'), { target: { value: 'Account security update' } });
    expect(sendButton()).toBeEnabled();

    fireEvent.click(sendButton());

    await waitFor(() => expect(notifyCall()).toBeDefined());
    expect(notifyCall()![1]).toMatchObject({ emailSafetyMembers: true, counselConsulted: true, neutralSubject: 'Account security update' });
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Email 2 people and tell 1 in the app/));
  });

  it('does not show the safety fields when nobody in the list is in the safety group', async () => {
    apiMock.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/notify-users/preview')) return { data: { success: true, requested: 1, found: 1, safetyMembers: 0, ordinaryMembers: 1 } };
      throw new Error(`unexpected ${url}`);
    });
    const ids = await openForm();
    fireEvent.change(ids, { target: { value: 'user-ordinary' } });

    expect(await screen.findByText(/1 will be emailed/)).toBeInTheDocument();
    expect(screen.queryByText(/Members who use Safe Mode or have reported someone/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Email them as well as telling them in the app')).not.toBeInTheDocument();
  });

  it('does not let a failed check pass for "nobody is at risk"', async () => {
    apiMock.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/notify-users/preview')) throw new Error('network');
      throw new Error(`unexpected ${url}`);
    });
    const ids = await openForm();
    fireEvent.change(screen.getByLabelText('What happened, in the words they will read'), { target: { value: 'Some details were readable.' } });
    fireEvent.change(ids, { target: { value: 'user-ordinary' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing can be sent yet/);
    expect(sendButton()).toBeDisabled();
  });

  it('puts the members who were not reached back in the box, so pressing again tells them and nobody else', async () => {
    apiMock.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/notify-users/preview')) return { data: { success: true, ...split } };
      return { data: { success: true, requested: 2, emailed: 1, inApp: 0, safetyMembersInAppOnly: 0, failedUserIds: ['user-safe'] } };
    });
    const ids = await openForm();
    fireEvent.change(screen.getByLabelText('What happened, in the words they will read'), { target: { value: 'Some details were readable.' } });
    fireEvent.change(ids, { target: { value: 'user-ordinary user-safe' } });
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.click(sendButton());

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/1 person was not reached/)));
    expect((screen.getByLabelText('Member ids to notify') as HTMLTextAreaElement).value).toBe('user-safe');
    // The wording stays too, so the second send says the same thing as the first.
    expect((screen.getByLabelText('What happened, in the words they will read') as HTMLTextAreaElement).value).toBe('Some details were readable.');
  });

  it('words the button for one person and for several, without mangling the word "person"', async () => {
    apiMock.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/notify-users/preview')) return { data: { success: true, requested: 1, found: 1, safetyMembers: 0, ordinaryMembers: 1 } };
      throw new Error(`unexpected ${url}`);
    });
    const ids = await openForm();
    fireEvent.change(ids, { target: { value: 'user-ordinary' } });

    expect(await screen.findByRole('button', { name: 'Notify 1 person' })).toBeInTheDocument();

    apiMock.post.mockImplementation(async (url: string) => {
      if (url.endsWith('/notify-users/preview')) return { data: { success: true, requested: 2, found: 2, safetyMembers: 0, ordinaryMembers: 2 } };
      throw new Error(`unexpected ${url}`);
    });
    fireEvent.change(ids, { target: { value: 'user-ordinary user-other' } });

    expect(await screen.findByRole('button', { name: 'Notify 2 people' })).toBeInTheDocument();
  });
});
