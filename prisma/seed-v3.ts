/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to generate random data
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;

async function main() {
  console.log('Starting complete database seed...');

  try {
    // =============================================
    // BASIC USERS
    // =============================================
    console.log('\n👤 Creating Base Users...');

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

    // =============================================
    // ORGANIZATIONS
    // =============================================
    console.log('\n🏢 Creating Organizations...');
    
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

    // =============================================
    // AD CAMPAIGNS
    // =============================================
    console.log('\n📢 Creating Ad Campaigns...');
    
    const campaigns = await Promise.all([
      prisma.adCampaign.create({
        data: {
          organizationId: orgs[0].id,
          name: 'Summer 2025 Engineering Internship',
          objective: 'applications',
          budgetCents: BigInt(500000), // AU$5000
          dailyBudgetCents: BigInt(50000), // AU$500/day
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-02-28'),
          status: 'active',
          targetingJson: JSON.stringify({
            ageRange: [18, 30],
            education: ['Bachelor', 'Diploma'],
            interests: ['engineering', 'technology'],
            locations: ['Sydney', 'Melbourne'],
          }),
          impressions: BigInt(250000),
          clicks: BigInt(5000),
          conversions: BigInt(125),
          spend: BigInt(300000),
        },
      }),
      prisma.adCampaign.create({
        data: {
          organizationId: orgs[1].id,
          name: "Master's Degree Awareness Campaign",
          objective: 'reach',
          budgetCents: BigInt(750000), // AU$7500
          dailyBudgetCents: BigInt(75000), // AU$750/day
          startDate: new Date('2024-12-01'),
          endDate: new Date('2025-03-31'),
          status: 'active',
          targetingJson: JSON.stringify({
            ageRange: [22, 40],
            education: ['Bachelor'],
            interests: ['education', 'career-development'],
            locations: ['Australia'],
          }),
          impressions: BigInt(1000000),
          clicks: BigInt(15000),
          conversions: BigInt(300),
          spend: BigInt(600000),
        },
      }),
    ]);

    console.log(`✓ Created ${campaigns.length} advertising campaigns`);

    // =============================================
    // AD CREATIVES
    // =============================================
    console.log('\n🎨 Creating Ad Creatives...');
    
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
          impressions: BigInt(125000),
          clicks: BigInt(2500),
          conversions: BigInt(60),
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
          impressions: BigInt(125000),
          clicks: BigInt(2500),
          conversions: BigInt(65),
        },
      }),
    ]);

    console.log(`✓ Created ${creatives.length} ad creatives`);

    // =============================================
    // DAILY METRICS
    // =============================================
    console.log('\n📊 Creating Daily Metrics...');
    
    for (let i = 0; i < 15; i++) {
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

    console.log(`✓ Created daily metrics for 15 days`);

    // =============================================
    // LEADS
    // =============================================
    console.log('\n🎯 Creating Leads...');
    
    const leadsData = Array.from({ length: 1000 }, (_, i) => ({
      organizationId: orgs[randomInt(0, orgs.length - 1)].id,
      email: `lead-${i}@example.com`,
      firstName: `Lead${i}`,
      lastName: 'User',
      phone: `+614${randomInt(10000000, 99999999)}`,
      score: randomInt(20, 95),
      tier: ['cold', 'warm', 'hot'][randomInt(0, 2)] as 'cold' | 'warm' | 'hot',
      status: ['new', 'contacted', 'qualified'][randomInt(0, 2)] as 'new' | 'contacted' | 'qualified',
      source: 'ad_campaign',
      type: ['course', 'apprenticeship', 'job'][randomInt(0, 2)] as 'course' | 'apprenticeship' | 'job',
    }));

    const leadsCreated = await prisma.lead.createMany({ data: leadsData, skipDuplicates: true });

    console.log(`✓ Created ${leadsCreated.count} leads`);

    // =============================================
    // USER PROPENSITY SCORES
    // =============================================
    console.log('\n🧠 Creating Propensity Scores...');
    
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

    // =============================================
    // VIDEO ASSETS
    // =============================================
    console.log('\n🎥 Creating Video Assets...');
    
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

    // =============================================
    // VIDEO VARIANTS
    // =============================================
    console.log('\n📹 Creating Video Variants...');
    
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

    // =============================================
    // SUBSCRIPTIONS
    // =============================================
    console.log('\n💳 Creating Subscriptions...');
    
    await prisma.subscription.upsert({
      where: { userId: memberUser.id },
      update: {
        status: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastInteractionAt: new Date(),
      },
      create: {
        userId: memberUser.id,
        tier: 'premium',
        status: 'active',
        monthlyPrice: 1299, // AU$12.99
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastInteractionAt: new Date(),
      },
    });

    console.log(`✓ Created subscription`);

    // =============================================
    // LIVE STREAMS & CREATOR ECONOMY
    // =============================================
    console.log('\n🔴 Creating Live Streams...');
    
    const liveStream = await prisma.liveStream.create({
      data: {
        creatorId: memberUser.id,
        title: 'Q&A with Hiring Manager - Tech Careers',
        status: 'live',
        viewerCount: 1250,
        startedAt: new Date(Date.now() - 30 * 60 * 1000), // Started 30 min ago
        totalGifts: BigInt(50000),
        creatorEarnings: BigInt(25000),
      },
    });

    console.log(`✓ Created live stream`);

    // =============================================
    // GIFT TRANSACTIONS
    // =============================================
    console.log('\n🎁 Creating Gift Transactions...');
    
    await Promise.all([
      prisma.giftTransaction.create({
        data: {
          creatorId: memberUser.id,
          senderId: admin.id,
          giftType: 'diamond',
          amount: 100,
          valueCents: BigInt(9999),
          creatorEarnings: BigInt(4999),
        },
      }),
      prisma.giftTransaction.create({
        data: {
          creatorId: memberUser.id,
          senderId: admin.id,
          giftType: 'heart',
          amount: 50,
          valueCents: BigInt(4999),
          creatorEarnings: BigInt(2499),
        },
      }),
    ]);

    console.log(`✓ Created gift transactions`);

    // =============================================
    // ORGANIZATION POSTS
    // =============================================
    console.log('\n📝 Creating Organization Posts...');
    
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
          watchTime: BigInt(0),
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
          watchTime: BigInt(12500),
          safetyScore: 0.98,
        },
      }),
    ]);

    console.log(`✓ Created organization posts`);

    // =============================================
    // USER INTERACTIONS
    // =============================================
    console.log('\n👤 Creating User Interactions...');
    
    const interactionsData = Array.from({ length: 1000 }, (_, i) => ({
      userId: memberUser.id,
      contentId: posts[randomInt(0, posts.length - 1)].id,
      actionType: ['view', 'like', 'comment', 'share'][randomInt(0, 3)] as 'view' | 'like' | 'comment' | 'share',
      durationSeconds: randomInt(5, 300),
      timestamp: new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000)),
    }));

    const interactionsCreated = await prisma.userInteraction.createMany({ data: interactionsData });

    console.log(`✓ Created ${interactionsCreated.count} user interactions`);

    // =============================================
    // CONTENT FEATURES (FOR ML)
    // =============================================
    console.log('\n🤖 Creating Content Features...');
    
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

    console.log(`✓ Created content features`);

    // =============================================
    // BANDIT ARMS
    // =============================================
    console.log('\n🎯 Initializing Bandit Arms...');

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

    // =============================================
    // USER FEATURES (FOR PERSONALIZATION)
    // =============================================
    console.log('\n🧠 Creating User Features...');

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

    // =============================================
    // BID MULTIPLIERS
    // =============================================
    console.log('\n💰 Creating Bid Multipliers...');
    
    await Promise.all([
      prisma.bidMultiplier.create({
        data: {
          campaignId: campaigns[0].id,
          timeOfDay: 'peak',
          device: 'mobile',
          multiplier: 1.3,
        },
      }),
      prisma.bidMultiplier.create({
        data: {
          campaignId: campaigns[0].id,
          timeOfDay: 'evening',
          device: 'desktop',
          multiplier: 0.85,
        },
      }),
    ]);

    console.log(`✓ Created bid multipliers`);

    // =============================================
    // AUCTION LOGS
    // =============================================
    console.log('\n🏆 Creating Auction Logs...');
    
    const auctionLogsData = Array.from({ length: 1000 }, (_, i) => ({
      campaignId: campaigns[randomInt(0, campaigns.length - 1)].id,
      winnerBid: randomFloat(5, 25),
      secondHighestBid: randomFloat(2, 20),
      impressionId: `imp-${Date.now()}-${i}`,
    }));

    const auctionLogsCreated = await prisma.auctionLog.createMany({ data: auctionLogsData });

    console.log(`✓ Created ${auctionLogsCreated.count} auction logs`);

    // =============================================
    // CREATOR PAYOUTS
    // =============================================
    console.log('\n💸 Creating Creator Payouts...');
    
    if (memberUser.id) {
      await prisma.creatorPayout.create({
        data: {
          creatorId: memberUser.id,
          totalAmount: BigInt(75000),
          status: 'completed',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31'),
        },
      });
      console.log(`✓ Created creator payout record`);
    }

    console.log('\n✅ v3.0 Database seeding completed successfully!');
    console.log('\n📊 Summary of Created Data:');
    console.log(`  • ${orgs.length} Organizations`);
    console.log(`  • ${campaigns.length} Ad Campaigns`);
    console.log(`  • ${leadsCreated.count} Leads`);
    console.log(`  • ${videos.length} Video Assets (with 3 variants each)`);
    console.log(`  • ${interactionsCreated.count} User Interactions`);
    console.log(`  • ${auctionLogsCreated.count} Auction Logs`);
    console.log(`  • Gift Transactions & Creator Revenue`);
    console.log(`  • Live Streams & Organization Posts`);
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
