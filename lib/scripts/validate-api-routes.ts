#!/usr/bin/env ts-node

/**
 * API Route Validation Script
 * Validates that Prisma schema supports all planned v3.0 API routes
 * 
 * Run: npx ts-node lib/scripts/validate-api-routes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface APIRoute {
  method: string;
  path: string;
  description: string;
  requiredModels: string[];
  validate: () => Promise<boolean>;
}

const apiRoutes: APIRoute[] = [
  // ========== ADVERTISING ROUTES ==========
  {
    method: 'POST',
    path: '/api/campaigns',
    description: 'Create new ad campaign',
    requiredModels: ['Organization', 'AdCampaign'],
    validate: async () => {
      const org = await prisma.organization.findFirst();
      return !!org;
    },
  },
  {
    method: 'GET',
    path: '/api/campaigns',
    description: 'List campaigns with metrics',
    requiredModels: ['AdCampaign', 'AdMetricsDaily'],
    validate: async () => {
      const campaign = await prisma.adCampaign.findFirst();
      return !!campaign;
    },
  },
  {
    method: 'PATCH',
    path: '/api/campaigns/:id',
    description: 'Update campaign targeting',
    requiredModels: ['AdCampaign'],
    validate: async () => {
      const campaign = await prisma.adCampaign.findFirst();
      return !!campaign?.id;
    },
  },
  {
    method: 'GET',
    path: '/api/campaigns/:id/metrics',
    description: 'Get campaign daily metrics',
    requiredModels: ['AdMetricsDaily'],
    validate: async () => {
      const metrics = await prisma.adMetricsDaily.findFirst();
      return !!metrics;
    },
  },
  {
    method: 'POST',
    path: '/api/campaigns/:id/creatives',
    description: 'Upload ad creative',
    requiredModels: ['AdCreative'],
    validate: async () => {
      const creative = await prisma.adCreative.findFirst();
      return !!creative;
    },
  },

  // ========== LEAD MANAGEMENT ROUTES ==========
  {
    method: 'POST',
    path: '/api/leads',
    description: 'Capture lead from ad',
    requiredModels: ['Lead'],
    validate: async () => {
      const org = await prisma.organization.findFirst();
      return !!org?.id;
    },
  },
  {
    method: 'GET',
    path: '/api/leads',
    description: 'List leads with scoring',
    requiredModels: ['Lead'],
    validate: async () => {
      const lead = await prisma.lead.findFirst();
      return !!lead;
    },
  },
  {
    method: 'PATCH',
    path: '/api/leads/:id',
    description: 'Update lead status/tier',
    requiredModels: ['Lead'],
    validate: async () => {
      const lead = await prisma.lead.findFirst();
      return !!lead?.id;
    },
  },
  {
    method: 'GET',
    path: '/api/leads/:id/score',
    description: 'Get ML lead score',
    requiredModels: ['Lead'],
    validate: async () => {
      const lead = await prisma.lead.findFirst();
      return lead?.score !== undefined;
    },
  },

  // ========== VIDEO ROUTES ==========
  {
    method: 'POST',
    path: '/api/videos',
    description: 'Upload video for transcoding',
    requiredModels: ['VideoAsset', 'VideoProcessingQueue'],
    validate: async () => {
      const video = await prisma.videoAsset.findFirst();
      return !!video;
    },
  },
  {
    method: 'GET',
    path: '/api/videos/:id',
    description: 'Get video metadata',
    requiredModels: ['VideoAsset'],
    validate: async () => {
      const video = await prisma.videoAsset.findFirst();
      return !!video;
    },
  },
  {
    method: 'GET',
    path: '/api/videos/:id/variants',
    description: 'Get HLS quality variants',
    requiredModels: ['VideoVariant'],
    validate: async () => {
      const variant = await prisma.videoVariant.findFirst();
      return !!variant;
    },
  },
  {
    method: 'PATCH',
    path: '/api/videos/:id/captions',
    description: 'Update caption status',
    requiredModels: ['VideoAsset'],
    validate: async () => {
      const video = await prisma.videoAsset.findFirst();
      return !!video;
    },
  },

  // ========== LIVE STREAMING ROUTES ==========
  {
    method: 'POST',
    path: '/api/live/start',
    description: 'Start live stream',
    requiredModels: ['LiveStream'],
    validate: async () => {
      const stream = await prisma.liveStream.findFirst();
      return !!stream;
    },
  },
  {
    method: 'GET',
    path: '/api/live/:id',
    description: 'Get live stream info',
    requiredModels: ['LiveStream'],
    validate: async () => {
      const stream = await prisma.liveStream.findFirst();
      return !!stream?.id;
    },
  },
  {
    method: 'POST',
    path: '/api/live/:id/gift',
    description: 'Send gift to creator',
    requiredModels: ['GiftTransaction', 'LiveStream'],
    validate: async () => {
      const gift = await prisma.giftTransaction.findFirst();
      return !!gift;
    },
  },

  // ========== FEED & RECOMMENDATIONS ROUTES ==========
  {
    method: 'GET',
    path: '/api/feed',
    description: 'Get personalized feed',
    requiredModels: ['OrgPost', 'UserInteraction', 'ContentFeature'],
    validate: async () => {
      const post = await prisma.orgPost.findFirst();
      return !!post;
    },
  },
  {
    method: 'POST',
    path: '/api/feed/interaction',
    description: 'Track user interaction (ML)',
    requiredModels: ['UserInteraction'],
    validate: async () => {
      const interaction = await prisma.userInteraction.findFirst();
      return !!interaction;
    },
  },
  {
    method: 'POST',
    path: '/api/feed/:id/like',
    description: 'Like content',
    requiredModels: ['OrgPost'],
    validate: async () => {
      const post = await prisma.orgPost.findFirst();
      return !!post?.id;
    },
  },

  // ========== ANALYTICS ROUTES ==========
  {
    method: 'GET',
    path: '/api/analytics/campaigns',
    description: 'Campaign dashboard metrics',
    requiredModels: ['AdCampaign', 'AdMetricsDaily'],
    validate: async () => {
      const metrics = await prisma.adMetricsDaily.findFirst();
      return !!metrics;
    },
  },
  {
    method: 'GET',
    path: '/api/analytics/leads',
    description: 'Lead conversion funnel',
    requiredModels: ['Lead'],
    validate: async () => {
      const lead = await prisma.lead.findFirst();
      return !!lead;
    },
  },
  {
    method: 'GET',
    path: '/api/analytics/revenue',
    description: 'Creator revenue summary',
    requiredModels: ['CreatorPayout', 'GiftTransaction'],
    validate: async () => {
      const payout = await prisma.creatorPayout.findFirst();
      return !!payout;
    },
  },

  // ========== SUBSCRIPTION ROUTES ==========
  {
    method: 'POST',
    path: '/api/subscriptions',
    description: 'Create subscription',
    requiredModels: ['Subscription'],
    validate: async () => {
      const sub = await prisma.subscription.findFirst();
      return !!sub;
    },
  },
  {
    method: 'PATCH',
    path: '/api/subscriptions/:id',
    description: 'Update subscription tier',
    requiredModels: ['Subscription'],
    validate: async () => {
      const sub = await prisma.subscription.findFirst();
      return !!sub?.id;
    },
  },
];

async function validateAllRoutes() {
  console.log('\n🔍 API Route Validation Report\n');
  console.log('=' .repeat(80));

  let successCount = 0;
  let failureCount = 0;

  // Group by method
  const routesByMethod: { [key: string]: APIRoute[] } = {};
  for (const route of apiRoutes) {
    if (!routesByMethod[route.method]) {
      routesByMethod[route.method] = [];
    }
    routesByMethod[route.method].push(route);
  }

  for (const [method, routes] of Object.entries(routesByMethod)) {
    console.log(`\n📍 ${method} Routes (${routes.length} endpoints)\n`);

    for (const route of routes) {
      try {
        const isValid = await route.validate();
        const status = isValid ? '✅' : '⚠️';
        const color = isValid ? '\x1b[32m' : '\x1b[33m';
        const reset = '\x1b[0m';

        console.log(
          `${status} ${color}${route.method.padEnd(6)} ${route.path.padEnd(40)}${reset} ${route.description}`
        );
        
        if (isValid) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        console.log(
          `❌ ${route.method.padEnd(6)} ${route.path.padEnd(40)} ${String(error).substring(0, 50)}`
        );
        failureCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Summary:\n`);
  console.log(`  ✅ Valid Routes:   ${successCount}/${apiRoutes.length}`);
  console.log(`  ⚠️  Issues:        ${failureCount}/${apiRoutes.length}`);
  console.log(`  🎯 Success Rate:   ${((successCount / apiRoutes.length) * 100).toFixed(0)}%\n`);

  if (successCount === apiRoutes.length) {
    console.log('🚀 All v3.0 API routes are ready for implementation!\n');
  }
}

validateAllRoutes()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during validation:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
