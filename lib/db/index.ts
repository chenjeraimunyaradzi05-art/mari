import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '@/lib/errors';

export const prisma = new PrismaClient();

/**
 * Campaign Database Queries
 */

export const campaignDb = {
  async create(data: Parameters<typeof prisma.adCampaign.create>[0]['data']) {
    return prisma.adCampaign.create({
      data,
      include: { creatives: true, dailyMetrics: true },
    });
  },

  async findById(id: string) {
    const campaign = await prisma.adCampaign.findUnique({
      where: { id },
      include: { creatives: true, dailyMetrics: { take: 30 } },
    });
    if (!campaign) throw new NotFoundError('Campaign', id);
    return campaign;
  },

  async findByOrganization(organizationId: string, skip = 0, take = 20) {
    return prisma.adCampaign.findMany({
      where: { organizationId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { creatives: true },
    });
  },

  async update(id: string, data: Parameters<typeof prisma.adCampaign.update>[0]['data']) {
    return prisma.adCampaign.update({
      where: { id },
      data,
      include: { creatives: true },
    });
  },

  async getMetrics(campaignId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return prisma.adMetricsDaily.findMany({
      where: {
        campaignId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });
  },

  async getAggregatedMetrics(campaignId: string) {
    const metrics = await prisma.adMetricsDaily.findMany({
      where: { campaignId },
    });

    const totals = metrics.reduce(
      (acc, m) => ({
        impressions: acc.impressions + Number(m.impressions),
        clicks: acc.clicks + Number(m.clicks),
        conversions: acc.conversions + Number(m.conversions),
        spend: acc.spend + Number(m.spendCents),
      }),
      { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
    );

    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : 0,
      cpc: totals.clicks > 0 ? (totals.spend / totals.clicks / 100).toFixed(2) : 0,
      cpa: totals.conversions > 0 ? (totals.spend / totals.conversions / 100).toFixed(2) : 0,
    };
  },
};

/**
 * Lead Database Queries
 */

export const leadDb = {
  async capture(data: Parameters<typeof prisma.lead.create>[0]['data']) {
    return prisma.lead.create({ data });
  },

  async findById(id: string) {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundError('Lead', id);
    return lead;
  },

  async findByEmail(email: string) {
    return prisma.lead.findFirst({ where: { email } });
  },

  async findByOrganization(organizationId: string, skip = 0, take = 20) {
    return prisma.lead.findMany({
      where: { organizationId },
      skip,
      take,
      orderBy: { score: 'desc' },
    });
  },

  async update(id: string, data: Parameters<typeof prisma.lead.update>[0]['data']) {
    return prisma.lead.update({ where: { id }, data });
  },

  async getLeadsByScore(organizationId: string, minScore: number) {
    return prisma.lead.findMany({
      where: { organizationId, score: { gte: minScore } },
      orderBy: { score: 'desc' },
    });
  },

  async getConversionFunnel(organizationId: string, startDate: Date, endDate: Date) {
    const leads = await prisma.lead.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    return {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      converted: leads.filter(l => l.status === 'converted').length,
    };
  },
};

/**
 * Video Database Queries
 */

export const videoDb = {
  async create(data: Parameters<typeof prisma.videoAsset.create>[0]['data']) {
    return prisma.videoAsset.create({
      data,
      include: { variants: true },
    });
  },

  async findById(id: string) {
    const video = await prisma.videoAsset.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!video) throw new NotFoundError('Video', id);
    return video;
  },

  async update(id: string, data: Parameters<typeof prisma.videoAsset.update>[0]['data']) {
    return prisma.videoAsset.update({
      where: { id },
      data,
      include: { variants: true },
    });
  },

  async getVariants(videoId: string) {
    return prisma.videoVariant.findMany({
      where: { videoId },
      orderBy: { quality: 'desc' },
    });
  },

  async getProcessingQueue(limit = 10) {
    return prisma.videoProcessingQueue.findMany({
      where: { status: 'pending' },
      orderBy: { priority: 'desc' },
      take: limit,
    });
  },
};

/**
 * Feed Database Queries
 */

export const feedDb = {
  async recordInteraction(data: Parameters<typeof prisma.userInteraction.create>[0]['data']) {
    return prisma.userInteraction.create({ data });
  },

  async getUserInteractions(userId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return prisma.userInteraction.findMany({
      where: { userId, timestamp: { gte: startDate } },
      orderBy: { timestamp: 'desc' },
    });
  },

  async getContentFeatures(contentId: string) {
    return prisma.contentFeature.findUnique({ where: { contentId } });
  },

  async getRecentPosts(limit = 20, offset = 0) {
    return prisma.orgPost.findMany({
      where: { visibility: 'public' },
      skip: offset,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { organization: true },
    });
  },
};

/**
 * Analytics Database Queries
 */

export const analyticsDb = {
  async getCampaignRevenue(organizationId: string, startDate: Date, endDate: Date) {
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { dailyMetrics: true },
    });

    return campaigns.map(c => ({
      id: c.id,
      name: c.name,
      spend: c.dailyMetrics.reduce((sum, m) => sum + Number(m.spendCents), 0),
      impressions: c.dailyMetrics.reduce((sum, m) => sum + Number(m.impressions), 0),
      clicks: c.dailyMetrics.reduce((sum, m) => sum + Number(m.clicks), 0),
      conversions: c.dailyMetrics.reduce((sum, m) => sum + Number(m.conversions), 0),
    }));
  },

  async getCreatorRevenue(creatorId: string, startDate: Date, endDate: Date) {
    const payouts = await prisma.creatorPayout.findMany({
      where: {
        creatorId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const gifts = await prisma.giftTransaction.findMany({
      where: {
        creatorId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const totalPayouts = payouts.reduce((sum, p) => sum + Number(p.totalAmount), 0);
    const totalGifts = gifts.reduce((sum, g) => sum + Number(g.creatorEarnings), 0);

    return {
      payouts: totalPayouts,
      gifts: totalGifts,
      total: totalPayouts + totalGifts,
      count: { payouts: payouts.length, gifts: gifts.length },
    };
  },

  async getTopCreators(limit = 10) {
    const creators = await prisma.giftTransaction.groupBy({
      by: ['creatorId'],
      _sum: { valueCents: true },
      orderBy: { _sum: { valueCents: 'desc' } },
      take: limit,
    });

    return creators;
  },
};

export { prisma };
