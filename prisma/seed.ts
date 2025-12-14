/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to generate random data
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;

async function main() {
  console.log('Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@athena.com' },
    update: {},
    create: {
      email: 'admin@athena.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
  });

  console.log('✓ Admin user created:', admin.email);

  // Create test member
  const memberPassword = await bcrypt.hash('member123', 10);
  const memberUser = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      email: 'member@example.com',
      password: memberPassword,
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'MEMBER',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
  });

  const member = await prisma.member.upsert({
    where: { userId: memberUser.id },
    update: {},
    create: {
      userId: memberUser.id,
      gender: 'FEMALE',
      culturalBackground: 'Australian',
      annualIncome: 45000,
      employmentStatus: 'EMPLOYED',
      safetyStatus: 'SAFE',
      dlpEnabled: true,
      currentPathway: 'CAREER_DEVELOPMENT',
      pathwayProgress: 0,
    },
  });

  console.log('✓ Member user created:', memberUser.email);
  console.log('✓ Member profile created:', member.id);

  // =============================================
  // V3.0 SEEDING: Advertising, Video, Creator
  // =============================================
  
  console.log('\n📊 Seeding v3.0 Advertising Module...');

  console.log('✓ Company user created:', companyUser.email);
  console.log('✓ Company created:', company.companyName);

  // Create test job
  const job = await prisma.job.create({
    data: {
      companyId: company.id,
      title: 'Software Developer (Entry Level)',
      description:
        'Join our team as a Junior Software Developer. We are looking for enthusiastic developers to help build innovative solutions.',
      requirements:
        'Bachelor degree in Computer Science or related field. Strong problem-solving skills. Team player mentality.',
      salaryMin: 60000,
      salaryMax: 75000,
      jobType: 'FULL_TIME',
      location: 'Sydney, NSW',
      status: 'OPEN',
      closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✓ Job posting created:', job.title);

  // Create test mentor
  const mentorPassword = await bcrypt.hash('mentor123', 10);
  const mentorUser = await prisma.user.upsert({
    where: { email: 'mentor@example.com' },
    update: {},
    create: {
      email: 'mentor@example.com',
      password: mentorPassword,
      firstName: 'Sarah',
      lastName: 'Smith',
      role: 'MENTOR',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
  });

  await prisma.mentor.upsert({
    where: { userId: mentorUser.id },
    update: {},
    create: {
      userId: mentorUser.id,
      specialization: ['Career Development', 'Leadership', 'Tech'],
      experience: 15,
      bio: 'Experienced mentor with 15 years in tech and career development',
      availability: 'Weekends and weekday evenings',
    },
  });

  console.log('✓ Mentor created:', mentorUser.email);

  // Create test TAFE coordinator
  const tafePassword = await bcrypt.hash('tafe123', 10);
  const tafeUser = await prisma.user.upsert({
    where: { email: 'coordinator@tafe.edu.au' },
    update: {},
    create: {
      email: 'coordinator@tafe.edu.au',
      password: tafePassword,
      firstName: 'TAFE',
      lastName: 'Coordinator',
      role: 'TAFE',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
  });

  const tafeCoordinator = await prisma.tafeCoordinator.upsert({
    where: { userId: tafeUser.id },
    update: {},
    create: {
      userId: tafeUser.id,
      institutionName: 'TAFE NSW',
      department: 'Business & Community Services',
    },
  });

  const course = await prisma.course.create({
    data: {
      coordinatorId: tafeCoordinator.id,
      title: 'Certificate III in Business',
      description: 'Gain essential business administration skills',
      duration: 12,
      level: 'BEGINNER',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✓ TAFE Coordinator created:', tafeUser.email);
  console.log('✓ Course created:', course.title);

  // Create test budget
  const budget = await prisma.budget.create({
    data: {
      memberId: member.id,
      name: 'December 2024 Budget',
      month: new Date(2024, 11, 1),
      totalAmount: 4000,
      categories: {
        create: [
          { name: 'Rent', allocatedAmount: 1500 },
          { name: 'Utilities', allocatedAmount: 300 },
          { name: 'Groceries', allocatedAmount: 400 },
          { name: 'Transportation', allocatedAmount: 200 },
          { name: 'Entertainment', allocatedAmount: 150 },
          { name: 'Savings', allocatedAmount: 450 },
        ],
      },
    },
  });

  console.log('✓ Budget created:', budget.name);

  // Create test expense
  const expense = await prisma.expense.create({
    data: {
      memberId: member.id,
      budgetId: budget.id,
      description: 'Monthly rent payment',
      amount: 1500,
      category: 'Rent',
      date: new Date(),
    },
  });

  console.log('✓ Expense created:', expense.description);

  // =============================================
  // V3.0 SEEDING: Advertising, Video, Creator
  // =============================================
  
  console.log('\n📊 Seeding v3.0 Advertising Module...');

  // Create organizations for advertising campaigns
  const orgs = await Promise.all([
    prisma.organization.create({
      data: {
        name: 'TechCorp Hiring',
        type: 'employer',
        email: 'hiring@techcorp.com',
        website: 'https://techcorp.com',
        verified: true,
        followers: 15000,
      },
    }),
    prisma.organization.create({
      data: {
        name: 'University of NSW',
        type: 'university',
        email: 'admissions@unsw.edu.au',
        website: 'https://unsw.edu.au',
        verified: true,
        followers: 50000,
      },
    }),
    prisma.organization.create({
      data: {
        name: 'Tradie Training Co',
        type: 'tradie',
        email: 'info@tradietraining.com.au',
        website: 'https://tradietraining.com',
        verified: true,
        followers: 8000,
      },
    }),
  ]);

  console.log(`✓ Created ${orgs.length} organizations`);

  // Create ad campaigns
  const campaigns = await Promise.all([
    prisma.adCampaign.create({
      data: {
        organizationId: orgs[0].id,
        name: 'Summer 2025 Engineering Internship',
        objective: 'applications',
        budgetCents: 500000, // AU$5000
        dailyBudgetCents: 50000, // AU$500/day
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-02-28'),
        status: 'active',
        targetingJson: JSON.stringify({
          ageRange: [18, 30],
          education: ['Bachelor', 'Diploma'],
          interests: ['engineering', 'technology'],
          locations: ['Sydney', 'Melbourne'],
        }),
        impressions: 250000n,
        clicks: 5000n,
        conversions: 125n,
        spend: 300000n,
      },
    }),
    prisma.adCampaign.create({
      data: {
        organizationId: orgs[1].id,
        name: 'Master\'s Degree Awareness Campaign',
        objective: 'reach',
        budgetCents: 750000, // AU$7500
        dailyBudgetCents: 75000, // AU$750/day
        startDate: new Date('2024-12-01'),
        endDate: new Date('2025-03-31'),
        status: 'active',
        targetingJson: JSON.stringify({
          ageRange: [22, 40],
          education: ['Bachelor'],
          interests: ['education', 'career-development'],
          locations: ['Australia'],
        }),
        impressions: 1000000n,
        clicks: 15000n,
        conversions: 300n,
        spend: 600000n,
      },
    }),
  ]);

  console.log(`✓ Created ${campaigns.length} advertising campaigns`);

  // Create ad creatives
  const creatives = await Promise.all([
    prisma.adCreative.create({
      data: {
        campaignId: campaigns[0].id,
        organizationId: orgs[0].id,
        title: 'Join Our Engineering Team',
        description: 'Internship opportunity for talented engineers',
        mediaUrl: 'https://cdn.example.com/ads/engineering-intern.jpg',
        mediaType: 'image',
        callToAction: 'Apply Now',
        landingUrl: 'https://techcorp.com/internship',
        format: 'image',
        impressions: 125000n,
        clicks: 2500n,
        conversions: 60n,
      },
    }),
    prisma.adCreative.create({
      data: {
        campaignId: campaigns[0].id,
        organizationId: orgs[0].id,
        title: 'Engineering Internship Video',
        description: 'Day in the life of our interns',
        mediaUrl: 'https://cdn.example.com/ads/engineering-day-in-life.mp4',
        mediaType: 'video',
        callToAction: 'Learn More',
        landingUrl: 'https://techcorp.com/internship',
        format: 'video',
        impressions: 125000n,
        clicks: 2500n,
        conversions: 65n,
      },
    }),
  ]);

  console.log(`✓ Created ${creatives.length} ad creatives`);

  // Create daily metrics
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    for (const campaign of campaigns) {
      await prisma.adMetricsDaily.create({
        data: {
          campaignId: campaign.id,
          date,
          impressions: BigInt(randomInt(20000, 50000)),
          clicks: BigInt(randomInt(300, 800)),
          conversions: BigInt(randomInt(5, 25)),
          spendCents: BigInt(randomInt(10000, 25000)),
          cpm: randomFloat(5, 12),
        },
      });
    }
  }

  console.log(`✓ Created daily metrics for 30 days`);

  // Create leads
  const leads = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      prisma.lead.create({
        data: {
          organizationId: orgs[randomInt(0, orgs.length - 1)].id,
          email: `lead-${i}@example.com`,
          firstName: `Lead${i}`,
          lastName: `User`,
          phone: `+614${randomInt(10000000, 99999999)}`,
          score: randomInt(20, 95),
          tier: ['cold', 'warm', 'hot'][randomInt(0, 2)] as 'cold' | 'warm' | 'hot',
          status: ['new', 'contacted', 'qualified'][randomInt(0, 2)] as 'new' | 'contacted' | 'qualified',
          source: 'ad_campaign',
          type: ['course', 'apprenticeship', 'job'][randomInt(0, 2)] as 'course' | 'apprenticeship' | 'job',
        },
      })
    )
  );

  console.log(`✓ Created ${leads.length} leads`);

  // Create user propensity scores
  if (memberUser.id) {
    await prisma.userPropensity.upsert({
      where: { userId: memberUser.id },
      update: {},
      create: {
        userId: memberUser.id,
        jobSeeking: 0.85,
        courseInterest: 0.72,
        spendingPower: 0.65,
        engagementLevel: 0.78,
        churnRisk: 0.15,
      },
    });
    console.log('✓ Created user propensity scores');
  }

  // Create video assets
  const videos = await Promise.all([
    prisma.videoAsset.create({
      data: {
        title: 'Engineering Internship Overview',
        description: 'A day in the life of our engineering interns',
        originalUrl: 'https://storage.example.com/videos/engineering-intern-original.mp4',
        cdnUrl: 'https://cdn.example.com/videos/engineering-intern-hls.m3u8',
        duration: 180,
        width: 1920,
        height: 1080,
        format: 'hls',
        status: 'ready',
        captions: 'https://cdn.example.com/videos/engineering-intern.vtt',
        captionStatus: 'completed',
      },
    }),
    prisma.videoAsset.create({
      data: {
        title: 'Campus Tour - UNSW',
        description: 'Explore our beautiful Sydney campus',
        originalUrl: 'https://storage.example.com/videos/unsw-tour-original.mp4',
        cdnUrl: 'https://cdn.example.com/videos/unsw-tour-hls.m3u8',
        duration: 420,
        width: 3840,
        height: 2160,
        format: 'hls',
        status: 'ready',
        captions: 'https://cdn.example.com/videos/unsw-tour.vtt',
        captionStatus: 'completed',
      },
    }),
  ]);

  console.log(`✓ Created ${videos.length} video assets`);

  // Create video variants (HLS quality tiers)
  for (const video of videos) {
    await Promise.all([
      prisma.videoVariant.create({
        data: {
          videoId: video.id,
          quality: '1080p',
          bitrate: '5000k',
          url: `${video.cdnUrl?.replace('.m3u8', '')}-1080p.m3u8`,
          fileSize: BigInt(1500000000),
        },
      }),
      prisma.videoVariant.create({
        data: {
          videoId: video.id,
          quality: '720p',
          bitrate: '2500k',
          url: `${video.cdnUrl?.replace('.m3u8', '')}-720p.m3u8`,
          fileSize: BigInt(750000000),
        },
      }),
      prisma.videoVariant.create({
        data: {
          videoId: video.id,
          quality: '480p',
          bitrate: '1000k',
          url: `${video.cdnUrl?.replace('.m3u8', '')}-480p.m3u8`,
          fileSize: BigInt(300000000),
        },
      }),
    ]);
  }

  console.log(`✓ Created video variants (3 per video)`);

  // Create subscriptions
  await Promise.all([
    prisma.subscription.create({
      data: {
        userId: memberUser.id,
        tier: 'premium',
        status: 'active',
        monthlyPrice: 1299, // AU$12.99
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastInteractionAt: new Date(),
      },
    }),
  ]);

  console.log(`✓ Created subscriptions`);

  // Create live streams
  const liveStreams = await Promise.all([
    prisma.liveStream.create({
      data: {
        creatorId: memberUser.id,
        title: 'Q&A with Hiring Manager - Tech Careers',
        status: 'live',
        viewerCount: 1250,
        startedAt: new Date(Date.now() - 30 * 60 * 1000), // Started 30 min ago
        totalGifts: 50000n,
        creatorEarnings: 25000n,
      },
    }),
  ]);

  console.log(`✓ Created live streams`);

  // Create gift transactions
  await Promise.all([
    prisma.giftTransaction.create({
      data: {
        creatorId: memberUser.id,
        senderId: admin.id,
        giftType: 'diamond',
        amount: 100,
        valueCents: 9999,
        creatorEarnings: 4999n,
      },
    }),
    prisma.giftTransaction.create({
      data: {
        creatorId: memberUser.id,
        senderId: admin.id,
        giftType: 'heart',
        amount: 50,
        valueCents: 4999,
        creatorEarnings: 2499n,
      },
    }),
  ]);

  console.log(`✓ Created gift transactions`);

  // Create org posts
  const posts = await Promise.all([
    prisma.orgPost.create({
      data: {
        organizationId: orgs[0].id,
        title: 'Now Hiring: Summer Interns 2025',
        content: 'We are looking for talented engineering students to join our internship program. Apply now!',
        mediaUrl: 'https://cdn.example.com/posts/hiring-summer-2025.jpg',
        visibility: 'public',
        likes: 324,
        comments: 47,
        shares: 89,
        watchTime: 0n,
        safetyScore: 0.99,
      },
    }),
    prisma.orgPost.create({
      data: {
        organizationId: orgs[1].id,
        title: 'Meet Our Alumni Success Stories',
        content: 'Our graduates are making impact around the world. See where they are now...',
        mediaUrl: 'https://cdn.example.com/posts/alumni-stories.jpg',
        visibility: 'public',
        likes: 1205,
        comments: 156,
        shares: 423,
        watchTime: 12500n,
        safetyScore: 0.98,
      },
    }),
  ]);

  console.log(`✓ Created organization posts`);

  // Create user interactions (for feed ML)
  for (let i = 0; i < 50; i++) {
    await prisma.userInteraction.create({
      data: {
        userId: memberUser.id,
        contentId: posts[randomInt(0, posts.length - 1)].id,
        actionType: ['view', 'like', 'comment', 'share'][randomInt(0, 3)] as 'view' | 'like' | 'comment' | 'share',
        durationSeconds: randomInt(5, 300),
        timestamp: new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000)),
      },
    });
  }

  console.log(`✓ Created 50 user interactions`);

  // Create content features
  for (const post of posts) {
    await prisma.contentFeature.create({
      data: {
        contentId: post.id,
        engagementRate: randomFloat(0.02, 0.15),
        watchTime: BigInt(randomInt(5000, 50000)),
        recencyHours: randomInt(1, 48),
        safetyScore: randomFloat(0.8, 1.0),
        creatorFollowers: randomInt(1000, 50000),
      },
    });
  }

  console.log(`✓ Created content features for feed ML`);

  // Create bandit arms
  await Promise.all(
    posts.map((post) =>
      prisma.banditArm.upsert({
        where: { contentId: post.id },
        create: { contentId: post.id, alpha: 1.0, beta: 1.0, impressions: 0, clicks: 0 },
        update: {},
      })
    )
  );

  console.log(`✓ Initialized bandit arms`);

  // Create user features (feature store)
  await prisma.userFeature.upsert({
    where: { userId: memberUser.id },
    update: {
      interests: ['wellbeing', 'career', 'money'],
      activityScore: 0.72,
      avgWatchSeconds: 86,
      completionRate: 0.64,
      lastActiveAt: new Date(),
    },
    create: {
      userId: memberUser.id,
      interests: ['wellbeing', 'career', 'money'],
      activityScore: 0.72,
      avgWatchSeconds: 86,
      completionRate: 0.64,
      lastActiveAt: new Date(),
    },
  });

  await prisma.userFeature.upsert({
    where: { userId: admin.id },
    update: {
      interests: ['operations', 'governance'],
      activityScore: 0.35,
      avgWatchSeconds: 40,
      completionRate: 0.42,
      lastActiveAt: new Date(),
    },
    create: {
      userId: admin.id,
      interests: ['operations', 'governance'],
      activityScore: 0.35,
      avgWatchSeconds: 40,
      completionRate: 0.42,
      lastActiveAt: new Date(),
    },
  });

  console.log(`✓ Created user features`);

  // Create bid multipliers
  await prisma.bidMultiplier.create({
    data: {
      campaignId: campaigns[0].id,
      timeOfDay: 'peak',
      device: 'mobile',
      multiplier: 1.3,
    },
  });

  await prisma.bidMultiplier.create({
    data: {
      campaignId: campaigns[0].id,
      timeOfDay: 'evening',
      device: 'desktop',
      multiplier: 0.85,
    },
  });

  console.log(`✓ Created bid multipliers`);

  // Create auction logs
  for (let i = 0; i < 20; i++) {
    await prisma.auctionLog.create({
      data: {
        campaignId: campaigns[randomInt(0, campaigns.length - 1)].id,
        winnerBid: randomFloat(5, 25),
        secondHighestBid: randomFloat(2, 20),
        impressionId: `imp-${Date.now()}-${i}`,
      },
    });
  }

  console.log(`✓ Created 20 auction logs`);

  // Create payout records
  if (memberUser.id) {
    await prisma.creatorPayout.create({
      data: {
        creatorId: memberUser.id,
        totalAmount: 75000n,
        status: 'completed',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
      },
    });
    console.log(`✓ Created creator payout record`);
  }

  console.log('\n✅ Database seeding completed successfully!');
  console.log('\nTest Accounts:');
  console.log('  Admin: admin@athena.com / admin123');
  console.log('  Member: member@example.com / member123');
  console.log('  Company: hr@techcompany.com / company123');
  console.log('  Mentor: mentor@example.com / mentor123');
  console.log('  TAFE: coordinator@tafe.edu.au / tafe123');
  console.log('\n📊 v3.0 Data Seeded:');
  console.log(`  • ${orgs.length} Organizations`);
  console.log(`  • ${campaigns.length} Ad Campaigns`);
  console.log(`  • ${leads.length} Leads`);
  console.log(`  • ${videos.length} Video Assets`);
  console.log(`  • 50 User Interactions`);
  console.log(`  • 20 Auction Logs`);
  console.log(`  • Multiple Gift Transactions & Creator Revenue`);
}
