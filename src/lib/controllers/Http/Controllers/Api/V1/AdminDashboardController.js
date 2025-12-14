const { prisma } = require('@/lib/prisma');

async function overview(req) {
  try {
    // Basic metrics
    const users = await prisma.user.count();
    const posts = await prisma.post.count();
    const leads = await prisma.lead.count();

    return new Response(JSON.stringify({ success: true, data: { users, posts, leads } }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { overview };
