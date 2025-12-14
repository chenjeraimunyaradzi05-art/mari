const { prisma } = require('@/lib/prisma');

async function listCountries(req) {
  try {
    const countries = await prisma.country.findMany({ orderBy: { name: 'asc' } });
    return new Response(JSON.stringify({ success: true, data: countries }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

async function updateCountry(req) {
  try {
    const id = req.url.split('/').pop();
    const body = await req.json();
    const country = await prisma.country.update({ where: { id }, data: { name: body.name ?? undefined, iso: body.iso ?? undefined } });
    return new Response(JSON.stringify({ success: true, data: country }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
  }
}

module.exports = { listCountries, updateCountry };
