const { prisma } = require('@/lib/prisma');
const tokens = require('@/lib/tokens');

async function list(req) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const where = userId ? { userId } : undefined;
    const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return new Response(JSON.stringify({ success: true, data: leads }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function create(req) {
  try {
    const body = await req.json();
    const lead = await prisma.lead.create({ data: { name: body.name, email: body.email, source: body.source ?? null } });
    return new Response(JSON.stringify({ success: true, data: lead }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function show(req) {
  try {
    const id = req.url.split('/').pop();
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify({ success: true, data: lead }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function remove(req) {
  try {
    const id = req.url.split('/').pop();
    await prisma.lead.delete({ where: { id } });
    return new Response(JSON.stringify({ success: true, message: 'Deleted' }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { list, create, show, remove };
