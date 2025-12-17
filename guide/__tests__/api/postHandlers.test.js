jest.mock('../../lib/prisma', () => ({
  prisma: { post: { create: jest.fn() } },
}))

const { handlePost } = require('../../lib/postHandlers')

describe('handlePost integration-like tests', () => {
  afterEach(() => jest.resetAllMocks())

  test('returns 401 when no userId', async () => {
    const req = { headers: new Map(), json: async () => ({ body: 'hi' }) }
    const r = await handlePost(req, null)
    expect(r.status).toBe(401)
  })

  test('creates post with json body', async () => {
    const { prisma } = require('../../lib/prisma')
    prisma.post.create.mockResolvedValue({ id: 'p1', content: 'hi' })

    const req = { headers: new Map([['content-type', 'application/json']]), json: async () => ({ body: 'hello' }) }
    const r = await handlePost(req, 'user-1')
    expect(r.status).toBe(200)
    expect(r.body.post).toBeDefined()
  })
})
