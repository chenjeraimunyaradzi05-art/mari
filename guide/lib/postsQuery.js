const { prisma } = require('./prisma')

async function getPaginatedPosts({ page = null, per_page = 20, limit = 20, cursor = null, filter = 'all' } = {}) {
  if (page !== null) {
    const p = Math.max(1, Number(page) || 1)
    const perPage = Math.min(100, Math.max(1, Number(per_page || 20)))
    const where = filter === 'all' ? {} : { visibility: filter }
    const total = await prisma.post.count({ where })
    const posts = await prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p - 1) * perPage, take: perPage })
    return {
      meta: { page: p, per_page: perPage, total, filter, has_more: p * perPage < total },
      data: posts,
    }
  }

  const posts = await prisma.post.findMany({
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: { author: { include: { profiles: true } } },
  })
  return { posts }
}

module.exports = { getPaginatedPosts }
