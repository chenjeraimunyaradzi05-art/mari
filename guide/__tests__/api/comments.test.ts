const { createComment, listComments } = require('../../lib/commentHandlers')

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }))
jest.mock('../../lib/prisma', () => ({ prisma: { comment: { create: jest.fn(), findMany: jest.fn() } } }))

afterEach(() => jest.resetAllMocks())

test('POST creates comment when authenticated', async () => {
  const { getServerSession } = require('next-auth/next')
  const { prisma } = require('../../lib/prisma')

  getServerSession.mockResolvedValue({ user: { id: 'u1' } })
  prisma.comment.create.mockResolvedValue({ id: 'c1', content: 'hi' })

  const res = await createComment('u1', 'p1', 'hi')
  expect(res.comment).toBeDefined()
  expect(prisma.comment.create).toHaveBeenCalledWith({ data: { postId: 'p1', authorId: 'u1', content: 'hi' } })
})

test('listComments returns comments', async () => {
  const { prisma } = require('../../lib/prisma')
  prisma.comment.findMany.mockResolvedValue([{ id: 'c1', content: 'one' }])
  const res = await listComments('p1')
  expect(Array.isArray(res.comments)).toBeTruthy()
})