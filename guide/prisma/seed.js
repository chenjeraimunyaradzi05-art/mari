const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding dev data...')

  // create admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    admin = await prisma.user.create({ data: { email: adminEmail, name: 'Admin', role: 'admin', password: 'seed' } })
    console.log('Created admin:', admin.email)
  }

  // create two sample users with profiles and handles
  const users = []
  for (const u of [
    { email: 'alice+dev@example.com', name: 'Alice', handle: 'alice' },
    { email: 'bob+dev@example.com', name: 'Bob', handle: 'bob' },
  ]) {
    let user = await prisma.user.findUnique({ where: { email: u.email } })
    if (!user) {
      user = await prisma.user.create({ data: { email: u.email, name: u.name, password: 'seed' } })
      console.log('Created user:', user.email)
    }

    let profile = await prisma.profile.findUnique({ where: { handle: u.handle } })
    if (!profile) {
      profile = await prisma.profile.create({ data: { userId: user.id, displayName: u.name, handle: u.handle, isPrimary: true } })
      console.log('Created profile for', u.handle)
    }

    users.push({ user, profile })
  }

  // Create a sample conversation and message between Alice and Bob
  const alice = users[0].user
  const bob = users[1].user

  const conv = await prisma.conversation.create({ data: { title: 'Dev Conversation' } })
  await prisma.conversationParticipant.createMany({ data: [ { conversationId: conv.id, userId: alice.id }, { conversationId: conv.id, userId: bob.id } ] })
  const msg = await prisma.message.create({ data: { conversationId: conv.id, authorId: alice.id, content: 'Hello Bob! @bob' } })
  await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: msg.createdAt } })
  console.log('Created conversation and message')

  // Create a sample post mentioning bob
  const post = await prisma.post.create({ data: { authorId: alice.id, content: 'Shoutout to @bob, welcome to the dev seed!' } })
  console.log('Created post', post.id)

  // Explicitly create a notification for bob from the mention (best-effort)
  await prisma.notification.create({ data: { userId: bob.id, actorId: alice.id, actorType: 'user', type: 'mention', data: { postId: post.id, excerpt: post.content.slice(0, 200) } } })
  console.log('Created mention notification for Bob')
  // create an extra test user
  try {
    const bcrypt = require('bcryptjs')
    const hashed = bcrypt.hashSync('password123', 10)

    await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: { name: 'Test User', password: hashed },
      create: { email: 'test@example.com', name: 'Test User', password: hashed },
    })
    console.log('Seeded user: test@example.com')
  } catch (e) {
    console.error('failed to create test user', e)
  }

  console.log('Seeding complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
// create an extra test user
try {
  const bcrypt = require('bcryptjs')
  const hashed = bcrypt.hashSync('password123', 10)

  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: { name: 'Test User', password: hashed },
    create: { email: 'test@example.com', name: 'Test User', password: hashed },
  })
  console.log('Seeded user: test@example.com')
} catch (e) {
  console.error('failed to create test user', e)
}
