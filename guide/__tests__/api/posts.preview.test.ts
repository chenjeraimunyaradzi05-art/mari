const { getPostPreview } = require('../../lib/postPreview')

jest.mock('../../lib/prisma', () => ({
  prisma: {
    post: { findUnique: jest.fn() },
  },
}))

afterEach(() => {
  jest.resetAllMocks()
})

test('getPostPreview throws 404 when post not found', async () => {
  const { prisma } = require('../../lib/prisma')
  prisma.post.findUnique.mockResolvedValue(null)

  await expect(getPostPreview('doesnotexist')).rejects.toMatchObject({ message: 'Not found', status: 404 })
})

test('getPostPreview returns post preview', async () => {
  const { prisma } = require('../../lib/prisma')
  const post = { id: 'p1', content: 'Hello world this is a post' }
  prisma.post.findUnique.mockResolvedValue(post)

  const res = await getPostPreview('p1')
  expect(res.data).toBeDefined()
  expect(res.data.post.id).toBe('p1')
  expect(res.data.preview.summary).toContain('Hello world')
})
