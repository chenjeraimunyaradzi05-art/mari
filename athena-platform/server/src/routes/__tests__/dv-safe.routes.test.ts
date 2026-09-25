/**
 * The HTTP layer over DV Safe Mode.
 *
 * The service underneath has its own tests. What had none was the layer a
 * phone actually talks to: the zod refusals, which member id the routes act
 * on, the PIN that may arrive in the query string or the body when a chat is
 * being deleted, and whether the panic button's honest answer — who was
 * reached, who was not, and the sentence to show her — survives the trip out.
 *
 * The id checks are the ones worth having. Every route here reads the signed-in
 * member from the token and never from the URL, so a path parameter can never
 * be made to name somebody else's safety profile; `/visibility/:viewerId` and
 * `/block/:userId` are the only two that take an id at all, and both use it as
 * the other person, not as the owner.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const service = {
  getSafetySettings: jest.fn(async (_userId: string) => ({}) as any),
  updateSafetySettings: jest.fn(async (_userId: string, _updates: unknown) => ({}) as any),
  enableSafeMode: jest.fn(async (_userId: string) => ({}) as any),
  triggerPanicButton: jest.fn(async (_userId: string) => ({}) as any),
  addEmergencyContact: jest.fn(async (_userId: string, _contact: unknown) => ({}) as any),
  removeEmergencyContact: jest.fn(async (_userId: string, _contactId: string) => true),
  blockUser: jest.fn(async (_userId: string, _blockedId: string) => true),
  isUserVisible: jest.fn(async (_userId: string, _viewerId?: string) => true),
  createSafeChat: jest.fn(async (_userId: string, _input: unknown) => ({}) as any),
  getSafeChats: jest.fn(async (_userId: string) => [] as any),
  accessSafeChat: jest.fn(async (_userId: string, _chatId: string, _pin?: string) => ({}) as any),
  sendSafeChatMessage: jest.fn(
    async (_userId: string, _chatId: string, _content: string, _minutes?: number, _pin?: string) => ({}) as any
  ),
  deleteSafeChat: jest.fn(async (_userId: string, _chatId: string, _pin?: string) => true),
  clearActivityTraces: jest.fn(async (_userId: string) => true),
  getDVResources: jest.fn((_region?: string) => [] as any),
  getSafeNotificationContent: jest.fn((_settings: unknown, _title: string, _message: string) => ({}) as any),
};

jest.mock('../../services/dv-safe.service', () => ({ __esModule: true, default: service, ...service }));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'her', role: 'USER', email: 'her@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';

beforeEach(() => {
  jest.clearAllMocks();
  service.getSafetySettings.mockResolvedValue({ userId: 'her', notificationsSafe: true });
  service.updateSafetySettings.mockResolvedValue({ userId: 'her' });
  service.enableSafeMode.mockResolvedValue({ userId: 'her', isSafeMode: true });
  service.removeEmergencyContact.mockResolvedValue(true);
  service.isUserVisible.mockResolvedValue(true);
  service.deleteSafeChat.mockResolvedValue(true);
  service.clearActivityTraces.mockResolvedValue(true);
  service.getDVResources.mockReturnValue([]);
});

describe('Settings', () => {
  it('reads and writes the signed-in member, never an id from the request', async () => {
    await request(app).get('/api/safety/dv/settings').expect(200);
    expect(service.getSafetySettings).toHaveBeenCalledWith('her');

    await request(app).put('/api/safety/dv/settings').send({ hideFromSearch: true }).expect(200);
    expect(service.updateSafetySettings).toHaveBeenCalledWith('her', { hideFromSearch: true });
  });

  it('refuses a quick-exit address that is not an http link, with 400 and a reason', async () => {
    const res = await request(app)
      .put('/api/safety/dv/settings')
      .send({ safeExitUrl: 'javascript:alert(1)' })
      .expect(400);

    expect(res.body.message ?? res.body.error).toMatch(/safeExitUrl/);
    expect(service.updateSafetySettings).not.toHaveBeenCalled();
  });

  it('refuses a switch sent as a string rather than coercing it to true', async () => {
    await request(app).put('/api/safety/dv/settings').send({ isSafeMode: 'yes' }).expect(400);
    expect(service.updateSafetySettings).not.toHaveBeenCalled();
  });

  it('turns everything on from the one-tap safe mode route', async () => {
    const res = await request(app).post('/api/safety/dv/safe-mode').send({}).expect(200);

    expect(service.enableSafeMode).toHaveBeenCalledWith('her');
    expect(res.body.settings.isSafeMode).toBe(true);
  });
});

describe('Panic button', () => {
  it('passes the outcome through whole, including who could not be reached', async () => {
    service.triggerPanicButton.mockResolvedValue({
      success: false,
      outcome: 'NOBODY_REACHED',
      reachedCount: 0,
      unreachableCount: 1,
      contactCount: 1,
      notifiedContacts: [],
      unreachableContacts: ['Sam'],
      smsAvailable: false,
      message: 'No message could be delivered to Sam. Please ring them yourself, and call 000 if you are in danger right now.',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
    });

    const res = await request(app).post('/api/safety/dv/panic').send({}).expect(200);

    // A client that reads nothing but `success` still cannot draw a success
    // over an alert that reached nobody.
    expect(res.body.success).toBe(false);
    expect(res.body.outcome).toBe('NOBODY_REACHED');
    expect(res.body.unreachableContacts).toEqual(['Sam']);
    expect(res.body.message).toContain('000');
  });
});

describe('Emergency contacts', () => {
  it('refuses a contact with no name instead of storing a blank one', async () => {
    await request(app)
      .post('/api/safety/dv/emergency-contacts')
      .send({ name: '  ', phone: '0400000000', relationship: 'sister' })
      .expect(400);

    expect(service.addEmergencyContact).not.toHaveBeenCalled();
  });

  it('defaults a new contact to being told when the panic button is pressed', async () => {
    service.addEmergencyContact.mockResolvedValue({ id: 'c1' });

    await request(app)
      .post('/api/safety/dv/emergency-contacts')
      .send({ name: 'Sam', phone: '0400000000', relationship: 'sister' })
      .expect(201);

    expect(service.addEmergencyContact).toHaveBeenCalledWith('her', expect.objectContaining({ notifyOnPanic: true }));
  });

  it('answers 404 for a contact that is not hers to remove', async () => {
    service.removeEmergencyContact.mockResolvedValue(false);

    await request(app).delete('/api/safety/dv/emergency-contacts/nope').expect(404);
  });
});

describe('Blocks and visibility', () => {
  it('blocks the person named in the path on behalf of the signed-in member', async () => {
    await request(app).post('/api/safety/dv/block/him').send({}).expect(200);

    expect(service.blockUser).toHaveBeenCalledWith('her', 'him');
  });

  it('answers whether that person can find her, and asks about her own profile', async () => {
    service.isUserVisible.mockResolvedValue(false);

    const res = await request(app).get('/api/safety/dv/visibility/him').expect(200);

    expect(service.isUserVisible).toHaveBeenCalledWith('her', 'him');
    expect(res.body.isVisible).toBe(false);
  });
});

describe('Safe chats', () => {
  it('refuses a PIN that is not 4 to 10 digits', async () => {
    await request(app).post('/api/safety/dv/chats').send({ name: 'Groceries', accessPin: '12' }).expect(400);
    await request(app).post('/api/safety/dv/chats').send({ name: 'Groceries', accessPin: 'abcd' }).expect(400);

    expect(service.createSafeChat).not.toHaveBeenCalled();
  });

  it('caps an auto-delete at a week rather than accepting any number of minutes', async () => {
    await request(app)
      .post('/api/safety/dv/chats/chat-1/messages')
      .send({ content: 'ok', autoDeleteMinutes: 999999 })
      .expect(400);

    expect(service.sendSafeChatMessage).not.toHaveBeenCalled();
  });

  it('takes the delete PIN from the query string as well as the body', async () => {
    // A woman deleting a chat in a hurry may be following a link rather than
    // filling in a form, so both carry the PIN.
    await request(app).delete('/api/safety/dv/chats/chat-1?pin=1234').expect(200);
    expect(service.deleteSafeChat).toHaveBeenCalledWith('her', 'chat-1', '1234');

    jest.clearAllMocks();
    service.deleteSafeChat.mockResolvedValue(true);

    await request(app).delete('/api/safety/dv/chats/chat-1').send({ pin: '5678' }).expect(200);
    expect(service.deleteSafeChat).toHaveBeenCalledWith('her', 'chat-1', '5678');
  });

  it('refuses a malformed delete PIN with 400 rather than handing it to the service', async () => {
    await request(app).delete('/api/safety/dv/chats/chat-1?pin=nope').expect(400);
    expect(service.deleteSafeChat).not.toHaveBeenCalled();
  });
});

describe('Traces and resources', () => {
  it('tells the client exactly what it has to clear on its own side', async () => {
    const res = await request(app).post('/api/safety/dv/clear-traces').send({}).expect(200);

    expect(res.body.clientInstructions).toMatchObject({
      clearLocalStorage: true,
      clearSessionStorage: true,
      replaceHistory: true,
    });
  });

  it('shapes a notification preview from her own settings, not from anything the caller sends', async () => {
    service.getSafeNotificationContent.mockReturnValue({ title: 'New Update', message: 'You have a new update. Open app to view.' });

    const res = await request(app)
      .post('/api/safety/dv/safe-notification')
      .send({ title: 'Message from Rachel', message: 'are you safe tonight?' })
      .expect(200);

    expect(service.getSafetySettings).toHaveBeenCalledWith('her');
    expect(res.body.title).toBe('New Update');
    expect(res.body.message).not.toContain('Rachel');
  });
});
