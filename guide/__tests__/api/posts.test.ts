const { handlePost } = require('../../lib/postHandlers')

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('../../lib/prisma', () => ({
  prisma: {
    post: { create: jest.fn() },
  },
}))

afterEach(() => {
  jest.resetAllMocks()
})

test('handlePost creates post when userId provided', async () => {
  const { prisma } = require('../../lib/prisma')
  prisma.post.create.mockResolvedValue({ id: 'p1', content: 'hello', authorId: 'user-1' })

  const req = { headers: new Map([['content-type', 'application/json']]), json: async () => ({ body: 'hello' }) }
  const r = await handlePost(req, 'user-1')
  expect(r.status).toBe(200)
  expect(prisma.post.create).toHaveBeenCalledWith({ data: { authorId: 'user-1', content: 'hello' } })
})

test('handlePost returns 401 when no userId', async () => {
  const req = { headers: new Map(), json: async () => ({ body: 'hello' }) }
  const r = await handlePost(req, null)
  expect(r.status).toBe(401)
})