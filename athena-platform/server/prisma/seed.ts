/**
 * Database Seed Script
 * Generates comprehensive demo data for development and E2E testing
 */

import { PrismaClient, Persona, UserRole, JobType, JobStatus, PostType, NotificationType, SubscriptionTier, ApplicationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==========================================
// SEED DATA
// ==========================================

const FIRST_NAMES = [
  'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia',
  'Harper', 'Evelyn', 'Abigail', 'Emily', 'Elizabeth', 'Sofia', 'Avery',
  'Ella', 'Scarlett', 'Grace', 'Chloe', 'Victoria', 'Riley', 'Aria', 'Lily',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore',
];

const CITIES = [
  { city: 'Sydney', state: 'NSW' },
  { city: 'Melbourne', state: 'VIC' },
  { city: 'Brisbane', state: 'QLD' },
  { city: 'Perth', state: 'WA' },
  { city: 'Adelaide', state: 'SA' },
];

const JOB_TITLES = [
  'Software Engineer', 'Product Manager', 'Data Analyst', 'UX Designer',
  'Marketing Manager', 'Sales Representative', 'HR Coordinator', 'Finance Analyst',
  'Project Manager', 'Business Analyst', 'Customer Success Manager', 'Content Writer',
];

const COMPANIES = [
  'TechCorp Australia', 'Digital Solutions', 'Innovation Labs', 'StartUp Hub',
  'CloudTech Systems', 'DataDriven Co', 'Creative Agency', 'FinanceFirst',
];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Consulting',
];

const SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'SQL', 'AWS',
  'Leadership', 'Communication', 'Problem Solving', 'Project Management',
  'Digital Marketing', 'Data Analysis', 'UX Research', 'Agile Methodology',
];

const POST_CONTENT = [
  "Just landed my dream job! Hard work really pays off. #CareerWins",
  "Attended an amazing networking event today. The connections are invaluable!",
  "Sharing some tips on how I aced my last interview. Thread 🧵",
  "Grateful for my mentors who guided me through my career transition.",
  "Looking for advice on negotiating salary. Any tips from the community?",
];

const POST_IMAGES = [
  "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop"
];

const COURSES = [
  {
    title: 'Advanced React patterns',
    description: 'Master modern React with hooks, context, and performance optimization techniques.',
    type: 'certificate',
    durationMonths: 2,
    studyMode: ['online', 'self-paced'],
    cost: 199,
    fundingOptions: [],
    employmentRate: 92,
    avgStartingSalary: 110000
  },
  {
    title: 'Data Science Bootcamp',
    description: 'Intensive 12-week program covering Python, SQL, Machine Learning, and Neural Networks.',
    type: 'bootcamp',
    durationMonths: 3,
    studyMode: ['full-time', 'online'],
    cost: 12000,
    fundingOptions: ['ISA', 'Payment Plan'],
    employmentRate: 88,
    avgStartingSalary: 95000
  },
  {
    title: 'Digital Marketing diploma',
    description: 'Learn SEO, SEM, content marketing, and analytics to drive growth for any business.',
    type: 'diploma',
    durationMonths: 6,
    studyMode: ['part-time', 'online'],
    cost: 4500,
    fundingOptions: ['Payment Plan'],
    employmentRate: 85,
    avgStartingSalary: 75000
  },
  {
    title: 'UX/UI Design Fundamentals',
    description: 'Build a portfolio of beautiful, functional user interfaces using Figma and design principles.',
    type: 'certificate',
    durationMonths: 2,
    studyMode: ['self-paced'],
    cost: 499,
    fundingOptions: [],
    employmentRate: 89,
    avgStartingSalary: 85000
  },
  {
    title: 'Financial Analysis for Leaders',
    description: 'Understand balance sheets, P&L, and cash flow to make better business decisions.',
    type: 'short_course',
    durationMonths: 1,
    studyMode: ['online'],
    cost: 299,
    fundingOptions: [],
    employmentRate: 95,
    avgStartingSalary: 120000
  }
];

// ==========================================
// MAIN SEED FUNCTION
// ==========================================

async function main() {
  console.log('🌱 Starting comprehensive database seed...\n');

  // Create skills
  console.log('📚 Creating skills...');
  const skills = await Promise.all(
    SKILLS.map((name, index) => {
      const category = index < 7 ? 'Technical' : index < 11 ? 'Soft Skills' : 'Industry';
      return prisma.skill.upsert({
        where: { name },
        update: {},
        create: { name, category },
      });
    })
  );
  console.log(`   Created ${skills.length} skills`);

  // Create demo users
  console.log('👥 Creating users...');
  const passwordHash = await bcrypt.hash('Demo123!', 10);
  
  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@athena.com' },
    update: {},
    create: {
      email: 'admin@athena.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'Admin',
      role: UserRole.ADMIN,
      persona: Persona.EMPLOYER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      city: 'Sydney',
      state: 'NSW',
      country: 'Australia',
      headline: 'Platform Administrator',
      bio: 'Managing the ATHENA platform',
      referralCode: 'ADMIN001',
    },
  });

  // Demo user for testing
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@athena.com' },
    update: {},
    create: {
      email: 'demo@athena.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Demo',
      displayName: 'Sarah D.',
      role: UserRole.USER,
      persona: Persona.EARLY_CAREER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      city: 'Melbourne',
      state: 'VIC',
      country: 'Australia',
      headline: 'Aspiring Product Manager',
      bio: 'Passionate about building products that make a difference.',
      currentJobTitle: 'Junior Business Analyst',
      currentCompany: 'TechCorp Australia',
      yearsExperience: 2,
      referralCode: 'DEMO001',
    },
  });

  // Create subscription for demo user
  await prisma.subscription.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      tier: SubscriptionTier.PREMIUM_CAREER,
      status: 'ACTIVE',
    },
  });

  const users = [adminUser, demoUser];

  // Create additional users
  for (let i = 0; i < 20; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const location = randomElement(CITIES);
    const email = `user${i + 1}@example.com`;
    
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName.charAt(0)}.`,
        role: UserRole.USER,
        persona: randomElement(Object.values(Persona)),
        emailVerified: true,
        emailVerifiedAt: new Date(),
        city: location.city,
        state: location.state,
        country: 'Australia',
        headline: `${randomElement(JOB_TITLES)} | ${randomElement(INDUSTRIES)}`,
        currentJobTitle: randomElement(JOB_TITLES),
        currentCompany: randomElement(COMPANIES),
        yearsExperience: randomInt(1, 15),
        referralCode: generateReferralCode(),
      },
    });
    users.push(user);
  }
  console.log(`   Created ${users.length} users`);

  // Assign skills to users
  console.log('🎯 Assigning skills to users...');
  for (const user of users) {
    const userSkills = randomElements(skills, randomInt(3, 6));
    for (const skill of userSkills) {
      await prisma.userSkill.upsert({
        where: { userId_skillId: { userId: user.id, skillId: skill.id } },
        update: {},
        create: {
          userId: user.id,
          skillId: skill.id,
          level: randomInt(1, 5),
          endorsed: randomInt(0, 20),
        },
      });
    }
  }

  // Create organizations
  console.log('🏢 Creating organizations...');
  const orgs = await Promise.all(
    COMPANIES.map((name, index) => {
      const location = randomElement(CITIES);
      const slug = generateSlug(name);
      return prisma.organization.upsert({
        where: { slug },
        update: {},
        create: {
          name,
          slug,
          description: `${name} is a leading company in the ${randomElement(INDUSTRIES)} industry.`,
          website: `https://${slug}.com.au`,
          city: location.city,
          state: location.state,
          country: 'Australia',
          type: 'company',
          industry: randomElement(INDUSTRIES),
          size: randomElement(['1-10', '11-50', '51-200', '201-500']),
          isVerified: index < 4,
          safetyScore: randomInt(70, 100),
        },
      });
    })
  );
  console.log(`   Created ${orgs.length} organizations`);

  // Create jobs
  console.log('💼 Creating jobs...');
  for (let i = 0; i < 30; i++) {
    const org = randomElement(orgs);
    const poster = randomElement(users.slice(2));
    const title = randomElement(JOB_TITLES);
    const location = randomElement(CITIES);
    const slug = `${generateSlug(title)}-${i}-${Date.now()}`;
    
    await prisma.job.upsert({
      where: { slug },
      update: {},
      create: {
        title,
        slug,
        description: `We are looking for a ${title} to join ${org.name}. Great opportunity!`,
        organizationId: org.id,
        postedById: poster.id,
        type: randomElement(Object.values(JobType)),
        status: JobStatus.ACTIVE,
        city: location.city,
        state: location.state,
        country: 'Australia',
        isRemote: Math.random() > 0.7,
        salaryMin: randomInt(60, 100) * 1000,
        salaryMax: randomInt(100, 160) * 1000,
        salaryType: 'annual',
        showSalary: true,
        experienceMin: randomInt(0, 3),
        experienceMax: randomInt(5, 10),
        viewCount: randomInt(50, 500),
        publishedAt: new Date(),
      },
    });
  }
  console.log('   Created 30 jobs');

  // Create posts
  console.log('📱 Creating posts...');
  const postCount = await prisma.post.count();
  if (postCount === 0) {
    for (let i = 0; i < 20; i++) {
      const author = randomElement(users);
      const includeImage = Math.random() > 0.5;
      
      await prisma.post.create({
        data: {
          authorId: author.id,
          type: includeImage ? PostType.IMAGE : PostType.TEXT,
          content: randomElement(POST_CONTENT),
          mediaUrls: includeImage ? [randomElement(POST_IMAGES)] : undefined,
          likeCount: randomInt(0, 50),
          commentCount: randomInt(0, 10),
          viewCount: randomInt(10, 200),
          isPublic: true,
        },
      });
    }
    console.log('   Created 20 posts');
  } else {
    console.log(`   Skipped (already have ${postCount} posts)`);
  }

  // Create notifications for demo user
  console.log('🔔 Creating notifications...');
  const notifCount = await prisma.notification.count({ where: { userId: demoUser.id } });
  if (notifCount === 0) {
    for (let i = 0; i < 5; i++) {
        await prisma.notification.create({
        data: {
            userId: demoUser.id,
            type: randomElement(Object.values(NotificationType)),
            title: `Notification ${i + 1}`,
            message: 'This is a sample notification.',
            link: '/dashboard',
            isRead: i < 2,
        },
        });
    }
     console.log('   Created 5 notifications');
  } else {
    console.log(`   Skipped (already have ${notifCount} notifications)`);
  }

  // Create groups (Prisma-backed)
  console.log('👥 Creating groups...');
  const groupCount = await prisma.group.count();
  if (groupCount === 0) {
    const g1 = await prisma.group.create({
      data: {
        name: 'Women in Tech',
        description: 'Career growth, mentorship, and support for women in tech.',
        privacy: 'PUBLIC',
        createdById: adminUser.id,
      },
    });
    const g2 = await prisma.group.create({
      data: {
        name: 'Founders Circle',
        description: 'For entrepreneurs building products and businesses.',
        privacy: 'PUBLIC',
        createdById: adminUser.id,
      },
    });

    await prisma.groupMember.createMany({
      data: [
        { groupId: g1.id, userId: adminUser.id, role: 'ADMIN' },
        { groupId: g2.id, userId: adminUser.id, role: 'ADMIN' },
      ],
      skipDuplicates: true,
    });

    await prisma.groupPost.createMany({
      data: [
        {
          groupId: g1.id,
          authorId: adminUser.id,
          content: 'Welcome to Women in Tech — introduce yourself!',
        },
        {
          groupId: g2.id,
          authorId: adminUser.id,
          content: 'Founders Circle kickoff: share what you’re building this year.',
        },
      ],
      skipDuplicates: true,
    });
    console.log('   Created 2 groups + welcome posts');
  } else {
    console.log(`   Skipped (already have ${groupCount} groups)`);
  }

  // Create events (Prisma-backed)
  console.log('📅 Creating events...');
  const eventCount = await prisma.event.count();
  if (eventCount === 0) {
    await prisma.event.createMany({
      data: [
        {
          title: 'Women in Tech Leadership Panel',
          description:
            'Join us for an inspiring panel discussion with women leaders from top tech companies. Learn about their career journeys and get actionable advice.',
          type: 'WEBINAR',
          format: 'VIRTUAL',
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          startTime: '10:00 AM',
          endTime: '11:30 AM',
          link: 'https://zoom.us/...',
          image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600',
          hostName: 'Sarah Chen',
          hostTitle: 'VP of Product at Google',
          hostAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
          baseAttendees: 245,
          maxAttendees: 500,
          price: 0,
          tags: ['Leadership', 'Career Growth', 'Tech'],
        },
        {
          title: 'Salary Negotiation Workshop',
          description:
            "Hands-on workshop where you'll practice negotiation techniques and get feedback from experts. Limited seats available.",
          type: 'WORKSHOP',
          format: 'VIRTUAL',
          date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          startTime: '2:00 PM',
          endTime: '4:00 PM',
          link: 'https://zoom.us/...',
          image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600',
          hostName: 'Jennifer Wu',
          hostTitle: 'Career Coach',
          hostAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
          baseAttendees: 38,
          maxAttendees: 50,
          price: 49,
          tags: ['Negotiation', 'Career', 'Salary'],
        },
        {
          title: 'SF Bay Area Women in Tech Mixer',
          description:
            'Network with fellow women in tech over drinks and appetizers. Make meaningful connections in a relaxed setting.',
          type: 'NETWORKING',
          format: 'IN_PERSON',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          startTime: '6:00 PM',
          endTime: '9:00 PM',
          location: 'The Battery, San Francisco',
          image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600',
          hostName: 'ATHENA Team',
          hostTitle: 'Community',
          hostAvatar: '',
          baseAttendees: 89,
          maxAttendees: 150,
          price: 25,
          tags: ['Networking', 'San Francisco', 'In-Person'],
        },
        {
          title: 'Product Management Career Fair',
          description:
            'Virtual career fair featuring top companies hiring for PM roles. Meet recruiters and learn about opportunities.',
          type: 'CONFERENCE',
          format: 'VIRTUAL',
          date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          startTime: '9:00 AM',
          endTime: '5:00 PM',
          link: 'https://hopin.com/...',
          image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600',
          hostName: 'ATHENA Careers',
          hostTitle: 'Career Team',
          hostAvatar: '',
          baseAttendees: 532,
          price: 0,
          tags: ['Career Fair', 'Product', 'Jobs'],
        },
      ],
      skipDuplicates: true,
    });
    console.log('   Created 4 events');
  } else {
    console.log(`   Skipped (already have ${eventCount} events)`);
  }
  // Create courses
  console.log('🎓 Creating courses...');
  const courseCount = await prisma.course.count();
  if (courseCount === 0) {
    for (const courseData of COURSES) {
      const org = randomElement(orgs); // Associate with one of the organizations as provider
      const slug = generateSlug(courseData.title);
      
      await prisma.course.create({
        data: {
          title: courseData.title,
          slug: slug,
          description: courseData.description,
          organizationId: org.id,
          providerName: org.name,
          type: courseData.type,
          durationMonths: courseData.durationMonths,
          studyMode: courseData.studyMode,
          cost: courseData.cost,
          fundingOptions: courseData.fundingOptions,
          employmentRate: courseData.employmentRate,
          avgStartingSalary: courseData.avgStartingSalary,
          intakeDates: [
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          ],
          isActive: true
        }
      });
    }
    console.log(`   Created ${COURSES.length} courses`);
  } else {
    console.log(`   Skipped (already have ${courseCount} courses)`);
  }
  console.log('\n✅ Database seed completed!\n');
  console.log('🔑 Demo Accounts:');
  console.log('   - Admin: admin@athena.com / Demo123!');
  console.log('   - User: demo@athena.com / Demo123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
