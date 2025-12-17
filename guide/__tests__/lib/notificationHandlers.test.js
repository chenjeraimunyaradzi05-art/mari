jest.mock('../../lib/prisma', () => ({
  prisma: { notification: { findMany: jest.fn(), updateMany: jest.fn() } },
}))

const { prisma } = require('../../lib/prisma')
const { getNotificationsForUser, markNotificationsRead } = require('../../lib/notificationHandlers')

describe('notificationHandlers', () => {
  afterEach(() => jest.resetAllMocks())

  test('getNotificationsForUser throws 401 when no userId', async () => {
    await expect(getNotificationsForUser(null)).rejects.toMatchObject({ message: 'Unauthorized', status: 401 })
  })

  test('getNotificationsForUser returns notifications', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }])
    const res = await getNotificationsForUser('u1')
    expect(res.notifications).toHaveLength(1)
    expect(res.notifications[0].id).toBe('n1')
  })

  test('markNotificationsRead validates input and updates', async () => {
    await expect(markNotificationsRead(null, ['n1'])).rejects.toMatchObject({ message: 'Unauthorized', status: 401 })
    await expect(markNotificationsRead('u1', [])).rejects.toMatchObject({ message: 'Validation', status: 422 })

    prisma.notification.updateMany.mockResolvedValue({ count: 2 })
    const res = await markNotificationsRead('u1', ['n1', 'n2'])
    expect(res.count).toBe(2)
  })
})
