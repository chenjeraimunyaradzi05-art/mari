/**
 * Every helper in services/api.ts and services/api-extensions.ts is asserted
 * against the path and verb the server serves (server/src/routes/*). The
 * older helpers drifted for months (`/videos/*` against a `/video` mount,
 * PUT where the server has PATCH, `/users/me/saved-jobs` for `/jobs/me/saved`)
 * because only the newer ones were tested; this closes that gap so a renamed
 * route fails here and in server/scripts/check-api-contract.js.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'https://api.athena.com/api' } } },
}));

import {
  api,
  WEB_URL,
  webUrl,
  unwrapApiData,
  authApi,
  jobsApi,
  userApi,
  notificationsApi,
  postsApi,
  messagesApi,
  groupsApi,
  safetyApi,
  mentorsApi,
  coursesApi,
  billingApi,
} from '../api';
import {
  videoApi,
  channelApi,
  apprenticeshipApi,
  skillsMarketplaceApi,
  apprenticeshipLevelLabel,
  categoryLabel,
  orderStatusLabel,
  readPackages,
  startingPrice,
} from '../api-extensions';

describe('mobile API client', () => {
  const get = jest.spyOn(api, 'get').mockImplementation(async () => ({ data: {} }) as any);
  const post = jest.spyOn(api, 'post').mockImplementation(async () => ({ data: {} }) as any);
  const put = jest.spyOn(api, 'put').mockImplementation(async () => ({ data: {} }) as any);
  const patch = jest.spyOn(api, 'patch').mockImplementation(async () => ({ data: {} }) as any);
  const del = jest.spyOn(api, 'delete').mockImplementation(async () => ({ data: {} }) as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives the web address from the API address', () => {
    expect(WEB_URL).toBe('https://athena.com');
    expect(webUrl('/wellness')).toBe('https://athena.com/wellness');
    expect(webUrl('contact')).toBe('https://athena.com/contact');
  });

  it('unwraps the { success, data } envelope and passes a bare payload through', () => {
    expect(unwrapApiData<number[]>({ success: true, data: [1, 2] })).toEqual([1, 2]);
    expect(unwrapApiData<number[]>([3])).toEqual([3]);
    expect(unwrapApiData<{ notifications: string[] }>({ data: { notifications: ['a'] } })).toEqual({ notifications: ['a'] });
  });

  it('auth calls the routes that exist', async () => {
    await authApi.login('a@b.c', 'pw');
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.c', password: 'pw' });
    await authApi.me();
    expect(get).toHaveBeenCalledWith('/auth/me');
    await authApi.forgotPassword('a@b.c');
    expect(post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.c' });
  });

  it('jobs: the list, a job, applying, saving, and the member’s lists under /jobs/me', async () => {
    await jobsApi.list({ limit: 20, search: 'nurse' });
    expect(get).toHaveBeenCalledWith('/jobs', { params: { limit: 20, search: 'nurse' } });
    await jobsApi.get('j1');
    expect(get).toHaveBeenCalledWith('/jobs/j1');
    await jobsApi.apply('j1', {});
    expect(post).toHaveBeenCalledWith('/jobs/j1/apply', {});
    await jobsApi.save('j1');
    await jobsApi.unsave('j1');
    expect(post).toHaveBeenCalledWith('/jobs/j1/save');
    expect(del).toHaveBeenCalledWith('/jobs/j1/save');

    await userApi.getApplications();
    await userApi.getSavedJobs();
    expect(get).toHaveBeenCalledWith('/jobs/me/applications');
    expect(get).toHaveBeenCalledWith('/jobs/me/saved');
  });

  it('the profile is PATCHed, never PUT', async () => {
    await userApi.getProfile();
    expect(get).toHaveBeenCalledWith('/users/me');
    await userApi.updateProfile({ firstName: 'Ana', headline: 'Nurse' });
    expect(patch).toHaveBeenCalledWith('/users/me', { firstName: 'Ana', headline: 'Nurse' });
    expect(put).not.toHaveBeenCalled();
  });

  it('notifications are listed and read with PATCH, one, many or all', async () => {
    await notificationsApi.list({ limit: 50 });
    expect(get).toHaveBeenCalledWith('/notifications', { params: { limit: 50 } });
    await notificationsApi.markRead('n1');
    expect(patch).toHaveBeenCalledWith('/notifications/n1/read');
    await notificationsApi.markManyRead(['n1', 'n2']);
    expect(patch).toHaveBeenCalledWith('/notifications/read-many', { ids: ['n1', 'n2'] });
    await notificationsApi.markAllRead();
    expect(patch).toHaveBeenCalledWith('/notifications/read-all');
    await notificationsApi.registerPushToken('tok');
    expect(post).toHaveBeenCalledWith('/notifications/push-token', { token: 'tok', provider: 'expo' });
    expect(put).not.toHaveBeenCalled();
  });

  it('the feed is /posts/feed and post actions use the routes that exist', async () => {
    await postsApi.list({ limit: 20 });
    expect(get).toHaveBeenCalledWith('/posts/feed', { params: { limit: 20 } });
    await postsApi.create({ content: 'hi' });
    expect(post).toHaveBeenCalledWith('/posts', { content: 'hi' });
    await postsApi.like('p1');
    await postsApi.unlike('p1');
    expect(post).toHaveBeenCalledWith('/posts/p1/like');
    expect(del).toHaveBeenCalledWith('/posts/p1/like');
    await postsApi.comment('p1', 'nice');
    expect(post).toHaveBeenCalledWith('/posts/p1/comments', { content: 'nice' });
  });

  it('reads and sends messages on the conversation’s messages path, as the server has it', async () => {
    await messagesApi.getConversations();
    expect(get).toHaveBeenCalledWith('/messages/conversations');
    await messagesApi.getMessages('c1');
    expect(get).toHaveBeenCalledWith('/messages/conversations/c1/messages');
    await messagesApi.send('c1', 'hello');
    expect(post).toHaveBeenCalledWith('/messages/conversations/c1/messages', { content: 'hello' });
  });

  it('groups, safety, mentors, courses and billing call the routes that exist', async () => {
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

  it('video lives under /video (the mount), is cursor-paginated, and views carry completion', async () => {
    await videoApi.getFeed({ limit: 10, cursor: 'v9', feed: 'following' });
    expect(get).toHaveBeenCalledWith('/video/feed', { params: { limit: 10, cursor: 'v9', feed: 'following' } });
    await videoApi.getVideo('v1');
    expect(get).toHaveBeenCalledWith('/video/v1');
    await videoApi.likeVideo('v1');
    await videoApi.unlikeVideo('v1');
    expect(post).toHaveBeenCalledWith('/video/v1/like');
    expect(del).toHaveBeenCalledWith('/video/v1/like');
    await videoApi.saveVideo('v1');
    await videoApi.unsaveVideo('v1');
    expect(post).toHaveBeenCalledWith('/video/v1/save');
    expect(del).toHaveBeenCalledWith('/video/v1/save');
    await videoApi.getComments('v1');
    expect(get).toHaveBeenCalledWith('/video/v1/comments', { params: undefined });
    await videoApi.addComment('v1', 'love this');
    expect(post).toHaveBeenCalledWith('/video/v1/comments', { content: 'love this' });
    await videoApi.recordView('v1', 12, 80);
    expect(post).toHaveBeenCalledWith('/video/v1/view', { watchDuration: 12, completionPct: 80, source: 'mobile' });
    await videoApi.getTrending({ period: 'week' });
    expect(get).toHaveBeenCalledWith('/video/trending', { params: { period: 'week' } });
    await videoApi.getByCategory('REEL');
    expect(get).toHaveBeenCalledWith('/video/category/REEL', { params: undefined });
  });

  it('channels: list, discover (not /search), join, leave with DELETE, messages, and a community channel on create', async () => {
    await channelApi.getChannels({ limit: 50 });
    expect(get).toHaveBeenCalledWith('/channels', { params: { limit: 50 } });
    await channelApi.discover({ search: 'career' });
    expect(get).toHaveBeenCalledWith('/channels/discover', { params: { search: 'career' } });
    await channelApi.getChannel('ch1');
    expect(get).toHaveBeenCalledWith('/channels/ch1');
    await channelApi.createChannel({ name: 'career-advice', description: '', isPublic: true });
    expect(post).toHaveBeenCalledWith('/channels', {
      type: 'COMMUNITY_CHANNEL',
      allowReplies: true,
      name: 'career-advice',
      description: '',
      isPublic: true,
    });
    await channelApi.joinChannel('ch1');
    expect(post).toHaveBeenCalledWith('/channels/ch1/join');
    await channelApi.leaveChannel('ch1');
    expect(del).toHaveBeenCalledWith('/channels/ch1/leave');
    await channelApi.getMessages('ch1', { limit: 50 });
    expect(get).toHaveBeenCalledWith('/channels/ch1/messages', { params: { limit: 50 } });
    await channelApi.sendMessage('ch1', 'hello');
    expect(post).toHaveBeenCalledWith('/channels/ch1/messages', { content: 'hello' });
    await channelApi.getMembers('ch1');
    expect(get).toHaveBeenCalledWith('/channels/ch1/members');
  });

  it('apprenticeships: list by framework, categories, apply, applications under /applications/me, bookmark', async () => {
    await apprenticeshipApi.getList({ page: 1, framework: 'Electrotechnology' });
    expect(get).toHaveBeenCalledWith('/apprenticeships', { params: { page: 1, framework: 'Electrotechnology' } });
    await apprenticeshipApi.getCategories();
    expect(get).toHaveBeenCalledWith('/apprenticeships/categories');
    await apprenticeshipApi.getDetail('a1');
    expect(get).toHaveBeenCalledWith('/apprenticeships/a1');
    await apprenticeshipApi.apply('a1', { coverLetter: 'Hi' });
    expect(post).toHaveBeenCalledWith('/apprenticeships/a1/apply', { coverLetter: 'Hi' });
    await apprenticeshipApi.getApplications();
    expect(get).toHaveBeenCalledWith('/apprenticeships/applications/me');
    await apprenticeshipApi.bookmark('a1');
    await apprenticeshipApi.unbookmark('a1');
    expect(post).toHaveBeenCalledWith('/apprenticeships/a1/bookmark');
    expect(del).toHaveBeenCalledWith('/apprenticeships/a1/bookmark');
    expect(apprenticeshipLevelLabel('CERTIFICATE_III')).toBe('Certificate III');
    expect(apprenticeshipLevelLabel('DIPLOMA')).toBe('Diploma');
  });

  it('marketplace: services, categories, a service, reviews, favourites, orders under /orders/me', async () => {
    await skillsMarketplaceApi.getServices({ page: 2, category: 'CREATIVE', search: 'logo' });
    expect(get).toHaveBeenCalledWith('/skills-marketplace/services', { params: { page: 2, category: 'CREATIVE', search: 'logo' } });
    await skillsMarketplaceApi.getCategories();
    expect(get).toHaveBeenCalledWith('/skills-marketplace/categories');
    await skillsMarketplaceApi.getService('s1');
    expect(get).toHaveBeenCalledWith('/skills-marketplace/services/s1');
    await skillsMarketplaceApi.getReviews('s1', { limit: 10 });
    expect(get).toHaveBeenCalledWith('/skills-marketplace/services/s1/reviews', { params: { limit: 10 } });
    await skillsMarketplaceApi.favourite('s1');
    await skillsMarketplaceApi.unfavourite('s1');
    expect(post).toHaveBeenCalledWith('/skills-marketplace/services/s1/favorite');
    expect(del).toHaveBeenCalledWith('/skills-marketplace/services/s1/favorite');
    await skillsMarketplaceApi.getFavourites();
    expect(get).toHaveBeenCalledWith('/skills-marketplace/favorites');
    await skillsMarketplaceApi.placeOrder('s1', { packageIndex: 0, requirements: 'A logo' });
    expect(post).toHaveBeenCalledWith('/skills-marketplace/services/s1/order', { packageIndex: 0, requirements: 'A logo' });
    await skillsMarketplaceApi.getMyOrders({ limit: 50 });
    expect(get).toHaveBeenCalledWith('/skills-marketplace/orders/me', { params: { limit: 50 } });
    await skillsMarketplaceApi.getOrder('o1');
    expect(get).toHaveBeenCalledWith('/skills-marketplace/orders/o1');
  });

  it('marketplace helpers read the Json packages column defensively and label enums', () => {
    expect(readPackages(null)).toEqual([]);
    expect(readPackages([{ name: 'Basic', price: '150', deliveryDays: 3 }, { price: 'nope' }, 'junk'])).toEqual([
      { name: 'Basic', description: undefined, price: 150, deliveryDays: 3, revisions: undefined, features: undefined },
    ]);
    const base = { id: 's', title: '', description: '', category: 'CREATIVE', rating: null, reviewCount: 0, createdAt: '', provider: null };
    expect(startingPrice({ ...base, hourlyRate: 80, minimumHours: 2, packages: null })).toEqual({ amount: 160, unit: '2 hr minimum' });
    expect(startingPrice({ ...base, hourlyRate: 0, packages: [{ price: 300, deliveryDays: 5 }, { price: 120, deliveryDays: 2 }] })).toEqual({ amount: 120, unit: 'package' });
    expect(startingPrice({ ...base, hourlyRate: 0, packages: null })).toBeNull();
    expect(categoryLabel('PROFESSIONAL')).toBe('Professional services');
    expect(categoryLabel('OTHER')).toBe('Other');
    expect(orderStatusLabel('REVISION_REQUESTED')).toBe('Revision requested');
  });
});
