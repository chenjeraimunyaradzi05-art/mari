const { prisma } = require('@/lib/prisma');

async function recentActivity(req) {
  try {
    // Simple example: recent posts and new users
    const posts = await prisma.post.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    return new Response(JSON.stringify({ success: true, data: { recentPosts: posts, recentUsers: users } }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { recentActivity };
