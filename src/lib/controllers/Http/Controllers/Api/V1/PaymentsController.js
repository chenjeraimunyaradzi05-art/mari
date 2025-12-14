const { prisma } = require('@/lib/prisma');
const tokens = require('@/lib/tokens');

async function list(req) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const where = userId ? { userId } : undefined;
    const payments = await prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return new Response(JSON.stringify({ success: true, data: payments }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function create(req) {
  try {
    const body = await req.json();
    const payment = await prisma.payment.create({ data: { userId: body.userId, amount: body.amount, currency: body.currency ?? 'USD', status: 'pending' } });
    return new Response(JSON.stringify({ success: true, data: payment }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { list, create };
