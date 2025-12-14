const { prisma } = require('@/lib/prisma');
const tokens = require('@/lib/tokens');

async function list(req, res) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || undefined;
    const where = q ? { OR: [{ email: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }] } : undefined;
    const users = await prisma.user.findMany({ where, take: 50 });
    return new Response(JSON.stringify({ success: true, data: users }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function show(req, res) {
  try {
    const parts = req.url.split('/');
    const id = parts[parts.length - 1];
    const user = await prisma.user.findUnique({ where: { id }, include: { member: true, company: true } });
    if (!user) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify({ success: true, data: user }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function update(req, res) {
  try {
    const authUserId = await tokens.getUserFromRequest(req);
    if (!authUserId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });

    const parts = req.url.split('/');
    const id = parts[parts.length - 1];
    if (id !== authUserId) return new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 });

    const body = await req.json();
    const allowed = {};
    if (body.firstName !== undefined) allowed.firstName = body.firstName;
    if (body.lastName !== undefined) allowed.lastName = body.lastName;
    if (body.locale !== undefined) allowed.locale = body.locale;

    const user = await prisma.user.update({ where: { id }, data: allowed });
    return new Response(JSON.stringify({ success: true, data: user }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { list, show, update };
