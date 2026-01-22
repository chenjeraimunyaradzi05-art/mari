const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany({
    where: { type: { not: 'TEXT' } },
    select: { id: true, type: true, mediaUrls: true, createdAt: true },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log('Posts with media:');
  posts.forEach(p => {
    console.log(`ID: ${p.id}, Type: ${p.type}, URLs: ${JSON.stringify(p.mediaUrls)}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
