import { describe, it, expect } from '@jest/globals';
import { groupNotifications, type NotificationRow } from '../notification-grouping.service';

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000);

function row(overrides: Partial<NotificationRow> & { id: string }): NotificationRow {
  return {
    userId: 'me',
    type: 'LIKE',
    title: 'New reaction',
    message: 'Mei C. celebrated your post',
    link: '/posts/p1',
    data: { actorId: 'mei', actorName: 'Mei C.' },
    isRead: false,
    readAt: null,
    createdAt: at(1),
    ...overrides,
  };
}

describe('groupNotifications', () => {
  it('folds reactions to the same post into one row that keeps every id', () => {
    const rows = [
      row({ id: 'n1', message: 'Mei C. celebrated your post', data: { actorName: 'Mei C.' }, createdAt: at(1) }),
      row({ id: 'n2', message: 'Priya S. celebrated your post', data: { actorName: 'Priya S.' }, createdAt: at(5), isRead: true }),
      row({ id: 'n3', message: 'Ana R. found insight in your post', data: { actorName: 'Ana R.' }, createdAt: at(9) }),
    ];
    const [group] = groupNotifications(rows);
    expect(group.ids).toEqual(['n1', 'n2', 'n3']);
    expect(group.count).toBe(3);
    expect(group.message).toBe('Mei C. and 2 others reacted to your post');
    expect(group.isRead).toBe(false);
  });

  it('keeps the exact verb when everyone did the same thing, and names two people', () => {
    const rows = [
      row({ id: 'n1', createdAt: at(1) }),
      row({ id: 'n2', message: 'Priya S. celebrated your post', data: { actorName: 'Priya S.' }, createdAt: at(2) }),
    ];
    expect(groupNotifications(rows)[0].message).toBe('Mei C. and Priya S. celebrated your post');
  });

  it('does not join different posts, different kinds, or rows too far apart', () => {
    const rows = [
      row({ id: 'n1', link: '/posts/p1', createdAt: at(1) }),
      row({ id: 'n2', link: '/posts/p2', createdAt: at(2) }),
      row({ id: 'n3', type: 'COMMENT', message: 'Mei C. commented on your post', link: '/posts/p1', createdAt: at(3) }),
      row({ id: 'n4', link: '/posts/p1', createdAt: at(4 * 24 * 60) }),
    ];
    expect(groupNotifications(rows).map((g) => g.ids)).toEqual([['n1'], ['n2'], ['n3'], ['n4']]);
  });

  it('gathers follows into one row and leaves rows without an actor alone', () => {
    const rows = [
      row({ id: 'f1', type: 'FOLLOW', message: 'Mei C. started following you', link: '/profile/mei', createdAt: at(1) }),
      row({ id: 'f2', type: 'FOLLOW', message: 'Priya S. started following you', link: '/profile/priya', data: { actorName: 'Priya S.' }, createdAt: at(2) }),
      row({ id: 'f3', type: 'FOLLOW', message: 'Ana R. started following you', link: '/profile/ana', data: { actorName: 'Ana R.' }, createdAt: at(3) }),
      row({ id: 'old', type: 'LIKE', message: 'Someone liked your post', data: null, createdAt: at(4) }),
      row({ id: 'sys', type: 'SYSTEM', message: 'Welcome', data: null, createdAt: at(5) }),
    ];
    const grouped = groupNotifications(rows);
    expect(grouped).toHaveLength(3);
    expect(grouped[0]).toMatchObject({ ids: ['f1', 'f2', 'f3'], message: 'Mei C. and 2 others started following you' });
    expect(grouped[1]).toMatchObject({ ids: ['old'], count: 1, message: 'Someone liked your post' });
    expect(grouped[2]).toMatchObject({ ids: ['sys'], count: 1 });
  });
});
