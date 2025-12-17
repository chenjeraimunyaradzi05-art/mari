jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    profile: { findUnique: jest.fn() },
    follow: { create: jest.fn(), findFirst: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
  },
}))

const { prisma } = require('../../lib/prisma')
const { followUser, unfollowUser, resolveUserId } = require('../../lib/profileHandlers')

describe('profileHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('resolveUserId returns user id when found by id', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' })
    const res = await resolveUserId('u1')
    expect(res).toBe('u1')
  })

  test('resolveUserId falls back to profile handle', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.profile.findUnique.mockResolvedValue({ userId: 'u2' })
    const res = await resolveUserId('handle')
    expect(res).toBe('u2')
  })

  test('followUser creates follow and returns count', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'tgt' })
    prisma.profile.findUnique.mockResolvedValue(null)
    prisma.follow.create.mockResolvedValue({ id: 'f1', followerId: 'me', targetId: 'tgt' })
    prisma.follow.count.mockResolvedValue(5)

    const res = await followUser('me', 'tgt')
    expect(res.follow).toEqual({ id: 'f1', followerId: 'me', targetId: 'tgt' })
    expect(res.followers_count).toBe(5)
  })

  test('followUser returns existing follow when already following (P2002)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'tgt' })
    prisma.profile.findUnique.mockResolvedValue(null)
    const err = new Error('Unique')
    err.code = 'P2002'
    prisma.follow.create.mockRejectedValue(err)
    prisma.follow.findFirst.mockResolvedValue({ id: 'existing', followerId: 'me', targetId: 'tgt' })
    prisma.follow.count.mockResolvedValue(10)

    const res = await followUser('me', 'tgt')
    expect(res.follow).toEqual({ id: 'existing', followerId: 'me', targetId: 'tgt' })
    expect(res.followers_count).toBe(10)
  })

  test('followUser throws 404 when target not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.profile.findUnique.mockResolvedValue(null)
    await expect(followUser('me', 'nope')).rejects.toMatchObject({ message: 'Target not found', status: 404 })
  })

  test('followUser throws 400 when following self', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'me' })
    await expect(followUser('me', 'me')).rejects.toMatchObject({ message: 'Cannot follow yourself', status: 400 })
  })

  test('unfollowUser deletes and returns count', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'tgt' })
    prisma.profile.findUnique.mockResolvedValue(null)
    prisma.follow.deleteMany.mockResolvedValue({ count: 1 })
    prisma.follow.count.mockResolvedValue(4)

    const res = await unfollowUser('me', 'tgt')
    expect(res.deleted).toBe(1)
    expect(res.followers_count).toBe(4)
  })
})
