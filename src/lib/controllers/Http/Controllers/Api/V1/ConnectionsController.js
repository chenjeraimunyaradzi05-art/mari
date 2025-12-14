const { prisma } = require('@/lib/prisma');
const tokens = require('@/lib/tokens');

async function list(req) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const connections = await prisma.connection.findMany({ where: { userId }, take: 100 });
    return new Response(JSON.stringify({ success: true, data: connections }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function connect(req) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const body = await req.json();
    const conn = await prisma.connection.create({ data: { userId, targetUserId: body.targetUserId, status: 'pending' } });
    return new Response(JSON.stringify({ success: true, data: conn }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function remove(req) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const id = req.url.split('/').pop();
    await prisma.connection.delete({ where: { id } });
    return new Response(JSON.stringify({ success: true, message: 'Removed' }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { list, connect, remove };
