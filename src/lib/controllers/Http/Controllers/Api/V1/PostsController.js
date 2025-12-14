const { prisma } = require('@/lib/prisma');
const tokens = require('@/lib/tokens');

async function list(req, res) {
  try {
    const url = new URL(req.url);
    const authorId = url.searchParams.get('authorId') || undefined;
    const where = authorId ? { authorId } : undefined;
    const posts = await prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return new Response(JSON.stringify({ success: true, data: posts }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function show(req, res) {
  try {
    const parts = req.url.split('/');
    const id = parts[parts.length - 1];
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify({ success: true, data: post }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function create(req, res) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const body = await req.json();
    const post = await prisma.post.create({ data: { authorId: userId, content: body.content ?? null, tags: body.tags ?? [], location: body.location ?? null } });
    return new Response(JSON.stringify({ success: true, data: post }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function remove(req, res) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const parts = req.url.split('/');
    const id = parts[parts.length - 1];
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    if (post.authorId !== userId) return new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 });
    await prisma.post.delete({ where: { id } });
    return new Response(JSON.stringify({ success: true, message: 'Deleted' }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { list, show, create, remove };
