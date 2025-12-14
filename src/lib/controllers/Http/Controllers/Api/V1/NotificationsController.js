const { prisma } = require('@/lib/prisma');
const tokens = require('@/lib/tokens');

async function list(req) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const notifications = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return new Response(JSON.stringify({ success: true, data: notifications }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function markRead(req) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const body = await req.json();
    await prisma.notification.updateMany({ where: { id: { in: body.ids }, userId }, data: { readAt: new Date() } });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { list, markRead };
