const { prisma } = require('@/lib/prisma');
const tokens = require('@/lib/tokens');

async function follow(req, res) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const body = await req.json();
    const { followable_type, followable_id } = body;
    if (!followable_type || !followable_id) return new Response(JSON.stringify({ success: false, message: 'Invalid' }), { status: 422 });
    const rows = await prisma.$queryRaw`SELECT * FROM social_follows WHERE follower_id = ${userId} AND followable_type = ${followable_type} AND followable_id = ${followable_id} LIMIT 1`;
    if (rows && rows[0]) return new Response(JSON.stringify({ success: true, message: 'Already following' }), { status: 200 });
    await prisma.$executeRaw`INSERT INTO social_follows (follower_id, followable_type, followable_id, created_at, updated_at) VALUES (${userId}, ${followable_type}, ${followable_id}, ${new Date().toISOString()}, ${new Date().toISOString()})`;
    return new Response(JSON.stringify({ success: true, message: 'Followed' }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function unfollow(req, res) {
  try {
    const userId = await tokens.getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });
    const body = await req.json();
    const { followable_type, followable_id } = body;
    await prisma.$executeRaw`DELETE FROM social_follows WHERE follower_id = ${userId} AND followable_type = ${followable_type} AND followable_id = ${followable_id}`;
    return new Response(JSON.stringify({ success: true, message: 'Unfollowed' }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function feed(req, res) {
  try {
    // Simple feed: return recent posts for now
    const posts = await prisma.post.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    return new Response(JSON.stringify({ success: true, data: posts }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { follow, unfollow, feed };
