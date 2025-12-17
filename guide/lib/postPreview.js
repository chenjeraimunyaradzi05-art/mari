const { prisma } = require('./prisma')

async function getPostPreview(id) {
  if (!id) {
    const err = new Error('Missing id')
    err.status = 400
    throw err
  }
  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) {
    const err = new Error('Not found')
    err.status = 404
    throw err
  }
  const content = (post.content || post.caption || '').toString()
  const summary = content.length > 240 ? content.slice(0, 237) + '...' : content
  return { data: { post, preview: { id: post.id, summary } } }
}

module.exports = { getPostPreview }
