/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to generate random data
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;

async function main() {
  console.log('Starting Global Social-Impact Seeder...');

  try {
    // =============================================
    // 1. GLOBAL USERS (Women & Feminine Themes)
    // =============================================
    console.log('\n👤 Creating Global Users...');

    const password = await bcrypt.hash('password123', 10);

    const globalUsers = [
      {
        email: 'elara.vance@example.com',
        firstName: 'Elara',
        lastName: 'Vance',
        role: 'MEMBER',
        dataRegion: 'us-east-1',
        locale: 'en-US',
        currency: 'USD',
        bio: 'Tech enthusiast and aspiring AI engineer. Passionate about ethical AI.',
      },
      {
        email: 'sofia.rossi@example.eu',
        firstName: 'Sofia',
        lastName: 'Rossi',
        role: 'MENTOR',
        dataRegion: 'eu-west-1',
        locale: 'it-IT',
        currency: 'EUR',
        bio: 'Senior Data Scientist based in Milan. Helping women break into tech.',
      },
      {
        email: 'priya.sharma@example.in',
        firstName: 'Priya',
        lastName: 'Sharma',
        role: 'MEMBER',
        dataRegion: 'ap-south-1',
        locale: 'hi-IN',
        currency: 'INR',
        bio: 'Student at IIT Bombay. Looking for internships in renewable energy.',
      },
      {
        email: 'amina.diallo@example.ng',
        firstName: 'Amina',
        lastName: 'Diallo',
        role: 'COMPANY',
        dataRegion: 'af-south-1',
        locale: 'fr-NG', // Example locale
        currency: 'NGN',
        bio: 'Founder of GreenTech Africa. Hiring sustainable agriculture experts.',
      },
      {
        email: 'mei.chen@example.cn',
        firstName: 'Mei',
        lastName: 'Chen',
        role: 'MEMBER',
        dataRegion: 'ap-east-1',
        locale: 'zh-CN',
        currency: 'CNY',
        bio: 'UX Designer in Shanghai. Love creating accessible interfaces.',
      },
    ];

    for (const u of globalUsers) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          email: u.email,
          password,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role as any,
          status: 'ACTIVE',
          emailVerified: new Date(),
          dataRegion: u.dataRegion,
          locale: u.locale,
          currency: u.currency,
        },
      });
      console.log(`✓ Created user: ${u.firstName} (${u.dataRegion})`);

      // Create Member/Mentor profile if applicable
      if (u.role === 'MEMBER') {
        await prisma.member.upsert({
          where: { userId: user.id },
          update: {},
          create: {
            userId: user.id,
            gender: 'FEMALE', // Defaulting to FEMALE as per request
            profileData: {
              headline: u.bio,
              about: u.bio,
              location: u.dataRegion,
              industry: 'Technology',
            },
          },
        });
      } else if (u.role === 'MENTOR') {
        await prisma.mentor.upsert({
          where: { userId: user.id },
          update: {},
          create: {
            userId: user.id,
            bio: u.bio,
            specialization: ['AI', 'Data Science', 'Leadership'],
            experience: 10,
            availability: 'Weekdays',
          },
        });
      }
    }

    // =============================================
    // 2. SOCIAL CONTENT (Feminine & Empowering)
    // =============================================
    console.log('\n📱 Creating Social Content...');

    const elara = await prisma.user.findUnique({ where: { email: 'elara.vance@example.com' } });
    const sofia = await prisma.user.findUnique({ where: { email: 'sofia.rossi@example.eu' } });

    if (elara && sofia) {
      const posts = [
        {
          authorId: elara.id,
          content: 'Just finished my first AI project! 🚀 #WomenInTech #AI',
          tags: ['WomenInTech', 'AI', 'Coding'],
          likes: 15,
        },
        {
          authorId: sofia.id,
          content: 'Hosting a free webinar on "Negotiating Your Salary" this Friday. Join us! 💼 #CareerAdvice',
          tags: ['CareerAdvice', 'Salary', 'Empowerment'],
          likes: 42,
        },
        {
          authorId: elara.id,
          content: 'Can anyone recommend a good book on leadership for introverts? 📚',
          tags: ['Leadership', 'Books', 'Introvert'],
          likes: 8,
        },
      ];

      for (const p of posts) {
        await prisma.post.create({
          data: {
            authorId: p.authorId,
            content: p.content,
            tags: p.tags,
            likesCount: p.likes,
          },
        });
      }
      console.log('✓ Created social posts');
    }

    // =============================================
    // 3. AI & JOBS (Strengthened)
    // =============================================
    console.log('\n🤖 Creating AI & Job Data...');

    const org = await prisma.organization.create({
      data: {
        name: 'Global Impact Corp',
        type: 'employer',
        verified: true,
        metadata: JSON.stringify({ mission: 'Empowering women globally' }),
      },
    });

    // Create a job with "Fairness" attributes (conceptual)
    // In a real scenario, these would be fields in the Job model
    // For now, we'll simulate it via metadata or description
    await prisma.adCampaign.create({
      data: {
        organizationId: org.id,
        name: 'Senior AI Ethics Researcher',
        objective: 'applications',
        budgetCents: 500000, // $5,000
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active',
        targetingJson: JSON.stringify({
          gender: ['female', 'non-binary'], // Affirmative action targeting
          skills: ['Ethics', 'Python', 'Philosophy'],
        }),
      },
    });
    console.log('✓ Created AI Ethics Job Campaign');

  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
