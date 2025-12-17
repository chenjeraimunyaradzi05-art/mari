const { prisma } = require('./prisma')

async function createComment(authorId, postId, content) {
  if (!authorId) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  const comment = await prisma.comment.create({ data: { postId, authorId, content } })
  return { comment }
}

async function listComments(postId) {
  const comments = await prisma.comment.findMany({ where: { postId }, orderBy: { createdAt: 'desc' } })
  return { comments }
}

module.exports = { createComment, listComments }
