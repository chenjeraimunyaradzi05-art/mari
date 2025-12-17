const { getPaginatedPosts } = require('../../lib/postsQuery')

jest.mock('../../lib/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn(), count: jest.fn() },
  },
}))

afterEach(() => {
  jest.resetAllMocks()
})

test('getPaginatedPosts returns paginated response for page', async () => {
  const { prisma } = require('../../lib/prisma')
  prisma.post.count.mockResolvedValue(45)
  prisma.post.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])

  const res = await getPaginatedPosts({ page: 2, per_page: 2 })
  expect(res.meta).toBeDefined()
  expect(res.meta.page).toBe(2)
  expect(res.data.length).toBe(2)
})
