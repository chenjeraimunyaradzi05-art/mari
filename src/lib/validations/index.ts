import { z } from 'zod';

// =============================================
// COMMON SCHEMAS
// =============================================

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const DateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

// =============================================
// IDENTITY & SAFETY
// =============================================

export const IdentityAppealSchema = z.object({
  appealText: z
    .string()
    .min(20, 'Appeal must be at least 20 characters so our team has enough detail')
    .max(2000, 'Appeal is too long'),
  enforcementState: z
    .enum(['flagged', 'blocked', 'review_required', 'gated'])
    .default('flagged'),
});

// =============================================
// CAMPAIGN SCHEMAS
// =============================================

export const CreateCampaignSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID required'),
  name: z.string().min(3, 'Campaign name must be at least 3 characters'),
  objective: z.enum(['reach', 'traffic', 'leads', 'applications']),
  budgetCents: z.coerce.bigint().positive('Budget must be positive'),
  dailyBudgetCents: z.coerce.bigint().positive().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  targetingJson: z.string().optional(),
});

export const UpdateCampaignSchema = z.object({
  name: z.string().min(3).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  targetingJson: z.string().optional(),
  dailyBudgetCents: z.coerce.bigint().positive().optional(),
});

export const CampaignListSchema = z.object({
  organizationId: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  ...PaginationSchema.shape,
});

export const CreateAdCreativeSchema = z.object({
  campaignId: z.string().min(1),
  organizationId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'carousel']).optional(),
  callToAction: z.string().min(2),
  landingUrl: z.string().url(),
  format: z.enum(['video', 'image', 'carousel', 'collection']),
});

export const UpdateAdCreativeSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'carousel']).optional(),
  callToAction: z.string().min(2).optional(),
  landingUrl: z.string().url().optional(),
  format: z.enum(['video', 'image', 'carousel', 'collection']).optional(),
});

// =============================================
// LEAD SCHEMAS
// =============================================

export const CaptureLead = z.object({
  organizationId: z.string().min(1),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  source: z.enum(['ad_campaign', 'form', 'api']).default('ad_campaign'),
  type: z.enum(['course', 'apprenticeship', 'job']).optional(),
  dataJson: z.string().optional(),
});

export const UpdateLeadSchema = z.object({
  score: z.number().int().min(0).max(100).optional(),
  tier: z.enum(['cold', 'warm', 'hot']).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted']).optional(),
});

export const LeadListSchema = z.object({
  organizationId: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  tier: z.enum(['cold', 'warm', 'hot']).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted']).optional(),
  ...PaginationSchema.shape,
});

// =============================================
// VIDEO SCHEMAS
// =============================================

export const UploadVideoSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  originalUrl: z.string().url(),
  mediaType: z.enum(['mp4', 'webm', 'hls']).optional(),
  duration: z.number().int().positive().optional(),
});

export const UpdateCaptionsSchema = z.object({
  captionStatus: z.enum(['pending', 'processing', 'completed', 'failed']),
  captions: z.string().url().optional(),
});

export const VideoQuerySchema = z.object({
  status: z.enum(['processing', 'ready', 'failed']).optional(),
  ...PaginationSchema.shape,
});

// =============================================
// FEED SCHEMAS
// =============================================

export const InteractionSchema = z.object({
  userId: z.string().min(1),
  contentId: z.string().min(1),
  actionType: z.enum(['view', 'like', 'comment', 'share']),
  durationSeconds: z.number().int().optional(),
  bucket: z.string().optional(),
  experiment: z.string().optional(),
});

export const FeedQuerySchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

// =============================================
// LIVE STREAM SCHEMAS
// =============================================

export const StartLiveStreamSchema = z.object({
  creatorId: z.string().min(1),
  title: z.string().min(3),
});

export const SendGiftSchema = z.object({
  creatorId: z.string().min(1),
  senderId: z.string().min(1),
  giftType: z.enum(['heart', 'diamond', 'star']),
  amount: z.number().int().positive(),
});

// =============================================
// SUBSCRIPTION SCHEMAS
// =============================================

export const CreateSubscriptionSchema = z.object({
  userId: z.string().min(1),
  tier: z.enum(['free', 'premium', 'premium_plus', 'creator']),
  monthlyPrice: z.number().int().positive().optional(),
  currency: z.string().min(3).max(3).optional(),
  email: z.string().email().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  customerId: z.string().optional(),
});

export const UpdateSubscriptionSchema = z.object({
  tier: z.enum(['free', 'premium', 'premium_plus', 'creator']).optional(),
  status: z
    .enum([
      'active',
      'trialing',
      'past_due',
      'incomplete',
      'incomplete_expired',
      'canceled',
      'paused',
      'unpaid',
    ])
    .optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

// =============================================
// ANALYTICS SCHEMAS
// =============================================

export const CampaignAnalyticsQuerySchema = z.object({
  campaignId: z.string().optional(),
  organizationId: z.string().optional(),
  ...DateRangeSchema.shape,
});

export const LeadAnalyticsQuerySchema = z.object({
  organizationId: z.string().optional(),
  ...DateRangeSchema.shape,
});

export const RevenueAnalyticsQuerySchema = z.object({
  creatorId: z.string().optional(),
  ...DateRangeSchema.shape,
});

// =============================================
// TYPE EXPORTS
// =============================================

export type CreateCampaign = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaign = z.infer<typeof UpdateCampaignSchema>;
export type CaptureLead = z.infer<typeof CaptureLead>;
export type UpdateLead = z.infer<typeof UpdateLeadSchema>;
export type StartLiveStream = z.infer<typeof StartLiveStreamSchema>;
export type SendGift = z.infer<typeof SendGiftSchema>;
export type UserInteraction = z.infer<typeof InteractionSchema>;
export type IdentityAppeal = z.infer<typeof IdentityAppealSchema>;
export type UpdateAdCreative = z.infer<typeof UpdateAdCreativeSchema>;
