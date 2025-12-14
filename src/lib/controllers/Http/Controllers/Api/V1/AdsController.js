const { prisma } = require('@/lib/prisma');

async function listCampaigns(req) {
  try {
    const campaigns = await prisma.adCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    return new Response(JSON.stringify({ success: true, data: campaigns }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function createCampaign(req) {
  try {
    const body = await req.json();
    const campaign = await prisma.adCampaign.create({ data: { name: body.name, organizationId: body.organizationId, budget: body.budget ?? 0 } });
    return new Response(JSON.stringify({ success: true, data: campaign }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { listCampaigns, createCampaign };
