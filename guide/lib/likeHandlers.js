const { prisma } = require('./prisma')

async function createLike(userId, postId) {
  if (!userId) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  try {
    await prisma.like.create({ data: { postId, userId } })
    const count = await prisma.like.count({ where: { postId } })
    return { liked: true, likes_count: count }
  } catch (e) {
    if (e && e.code === 'P2002') {
      const count = await prisma.like.count({ where: { postId } })
      return { liked: true, likes_count: count }
    }
    throw e
  }
}

async function deleteLike(userId, postId) {
  if (!userId) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  await prisma.like.deleteMany({ where: { postId, userId } })
  const count = await prisma.like.count({ where: { postId } })
  return { liked: false, likes_count: count }
}

module.exports = { createLike, deleteLike }
