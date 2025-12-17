const { createLike, deleteLike } = require('../../lib/likeHandlers')

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }))
jest.mock('../../lib/prisma', () => ({ prisma: { like: { create: jest.fn(), deleteMany: jest.fn(), count: jest.fn() } } }))

afterEach(() => jest.resetAllMocks())

test('POST creates like', async () => {
  const { getServerSession } = require('next-auth/next')
  const { prisma } = require('../../lib/prisma')
  getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  prisma.like.create.mockResolvedValue({ id: 'l1' })
  prisma.like.count.mockResolvedValue(1)

  const res = await createLike('u1', 'p1')
  expect(res.liked).toBeTruthy()
  expect(res.likes_count).toBe(1)
})

test('DELETE removes like', async () => {
  const { getServerSession } = require('next-auth/next')
  const { prisma } = require('../../lib/prisma')
  getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  prisma.like.deleteMany.mockResolvedValue({ count: 1 })
  prisma.like.count.mockResolvedValue(0)

  const res = await deleteLike('u1', 'p1')
  expect(res.liked).toBeFalsy()
  expect(res.likes_count).toBe(0)
})