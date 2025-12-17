const { getNotificationsForUser, markNotificationsRead } = require('../lib/notificationHandlers')

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }))
jest.mock('../lib/prisma', () => ({ prisma: { notification: { findMany: jest.fn(), updateMany: jest.fn() } } }))

afterEach(() => jest.resetAllMocks())

test('getNotificationsForUser returns notifications for user', async () => {
  const { getServerSession } = require('next-auth/next')
  const { prisma } = require('../lib/prisma')

  getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  prisma.notification.findMany.mockResolvedValue([{ id: 'n1', type: 'mention', data: { excerpt: 'hi' }, isRead: false, createdAt: new Date().toISOString() }])

  const res = await getNotificationsForUser('u1')
  expect(res.notifications).toHaveLength(1)
  expect(res.notifications[0].id).toBe('n1')
})

test('markNotificationsRead marks notifications', async () => {
  const { getServerSession } = require('next-auth/next')
  const { prisma } = require('../lib/prisma')

  getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  prisma.notification.updateMany.mockResolvedValue({ count: 1 })

  const res = await markNotificationsRead('u1', ['n1'])
  expect(res.count).toBe(1)
})
