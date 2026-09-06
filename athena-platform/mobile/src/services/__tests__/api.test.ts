import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://api.athena.com/api' } } },
}));

import { api, WEB_URL, messagesApi, postsApi, groupsApi, safetyApi, mentorsApi, coursesApi, billingApi } from '../api';

describe('mobile API client', () => {
  const get = jest.spyOn(api, 'get').mockImplementation(async () => ({ data: {} }) as any);
  const post = jest.spyOn(api, 'post').mockImplementation(async () => ({ data: {} }) as any);
  const put = jest.spyOn(api, 'put').mockImplementation(async () => ({ data: {} }) as any);
  const del = jest.spyOn(api, 'delete').mockImplementation(async () => ({ data: {} }) as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives the web address from the API address', () => {
    expect(WEB_URL).toBe('https://athena.com');
  });

  it('reads and sends messages on the conversation’s messages path, as the server has it', async () => {
    await messagesApi.getMessages('c1');
    expect(get).toHaveBeenCalledWith('/messages/conversations/c1/messages');
    await messagesApi.send('c1', 'hello');
    expect(post).toHaveBeenCalledWith('/messages/conversations/c1/messages', { content: 'hello' });
  });

  it('comments, groups, safety, mentors, courses and billing call the routes that exist', async () => {
    await postsApi.comment('p1', 'nice');
    expect(post).toHaveBeenCalledWith('/posts/p1/comments', { content: 'nice' });

    await groupsApi.join('g1');
    await groupsApi.post('g1', 'hi all');
    expect(post).toHaveBeenCalledWith('/groups/g1/join');
    expect(post).toHaveBeenCalledWith('/groups/g1/posts', { content: 'hi all' });

    await safetyApi.update({ isSafeMode: true });
    await safetyApi.removeContact('k1');
    expect(put).toHaveBeenCalledWith('/safety/dv/settings', { isSafeMode: true });
    expect(del).toHaveBeenCalledWith('/safety/dv/emergency-contacts/k1');

    await mentorsApi.book('m1', { scheduledAt: '2026-09-08T00:00:00.000Z', durationMinutes: 60 });
    expect(post).toHaveBeenCalledWith('/mentors/m1/book', { scheduledAt: '2026-09-08T00:00:00.000Z', durationMinutes: 60 });

    await coursesApi.enrol('c9');
    expect(post).toHaveBeenCalledWith('/courses/c9/enroll');
    await coursesApi.get('c9');
    await coursesApi.classroom('c9');
    await coursesApi.completeLesson('c9', 'l1');
    expect(get).toHaveBeenCalledWith('/courses/c9');
    expect(get).toHaveBeenCalledWith('/courses/c9/classroom');
    expect(post).toHaveBeenCalledWith('/courses/c9/lessons/l1/complete');

    await billingApi.pricing('AU');
    expect(get).toHaveBeenCalledWith('/payments/pricing', { params: { region: 'AU' } });
  });
});
