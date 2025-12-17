/* CommonJS helper for profile-related actions: resolveUserId, followUser, unfollowUser */
const { prisma } = require('./prisma')

async function resolveUserId(idOrHandle) {
  // try to find by id first
  const u = await prisma.user.findUnique({ where: { id: idOrHandle } })
  if (u) return u.id
  const profile = await prisma.profile.findUnique({ where: { handle: idOrHandle } })
  return profile ? profile.userId : null
}

async function followUser(currentUserId, targetIdentifier) {
  const targetId = await resolveUserId(targetIdentifier)
  if (!targetId) {
    const err = new Error('Target not found')
    err.status = 404
    throw err
  }
  if (targetId === currentUserId) {
    const err = new Error('Cannot follow yourself')
    err.status = 400
    throw err
  }

  try {
    const follow = await prisma.follow.create({ data: { followerId: currentUserId, targetId } })
    const followersCount = await prisma.follow.count({ where: { targetId } })
    return { follow, followers_count: followersCount }
  } catch (e) {
    // handle unique-constraint (already following)
    if (e && e.code === 'P2002') {
      const existing = await prisma.follow.findFirst({ where: { followerId: currentUserId, targetId } })
      const followersCount = await prisma.follow.count({ where: { targetId } })
      return { follow: existing, followers_count: followersCount }
    }
    throw e
  }
}

async function unfollowUser(currentUserId, targetIdentifier) {
  const targetId = await resolveUserId(targetIdentifier)
  if (!targetId) {
    const err = new Error('Target not found')
    err.status = 404
    throw err
  }
  const deleted = await prisma.follow.deleteMany({ where: { followerId: currentUserId, targetId } })
  const followersCount = await prisma.follow.count({ where: { targetId } })
  return { deleted: deleted.count, followers_count: followersCount }
}

module.exports = { resolveUserId, followUser, unfollowUser }
