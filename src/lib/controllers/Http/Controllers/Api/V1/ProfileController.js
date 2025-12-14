const { prisma } = require('@/lib/prisma');
const tokens = require('@/lib/tokens');

async function show(req, res) {
  try {
    const parts = req.url.split('/');
    const id = parts[parts.length - 1];
    const rows = await prisma.$queryRaw`SELECT * FROM profiles WHERE id = ${id} LIMIT 1`;
    const profile = rows && rows[0] ? rows[0] : null;
    if (!profile) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify({ success: true, data: profile }), { status: 200 });
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
    const rows = await prisma.$queryRaw`SELECT * FROM profiles WHERE id = ${id} LIMIT 1`;
    const profile = rows && rows[0] ? rows[0] : null;
    if (!profile) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    if (String(profile.user_id) !== String(authUserId)) return new Response(JSON.stringify({ success: false, message: 'Forbidden' }), { status: 403 });

    const body = await req.json();
    const updates = [];
    const params = [];
    for (const key of ['headline','bio','is_private']) {
      if (body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(body[key]);
      }
    }
    if (updates.length) {
      params.push(id);
      await prisma.$executeRawUnsafe(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`, ...params);
    }
    const refreshed = await prisma.$queryRaw`SELECT * FROM profiles WHERE id = ${id} LIMIT 1`;
    return new Response(JSON.stringify({ success: true, data: refreshed[0] }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { show, update };
