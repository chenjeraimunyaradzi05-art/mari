# Women Real Estate Platform — Listing, Media & Partnership Plan (Step 15)

## 1. Objectives

- Implement enhanced listing lifecycle with media management, audience targeting, and AI insight workflows.
- Enable partnership intents and collaboration journeys tied to listings and separate projects.
- Ensure data consistency and performance across CRUD interfaces, social sharing, and analytics.

## 2. Listing CRUD Enhancements

1. **Creation & Editing**
   - Livewire wizard for multi-step listing creation (core details, media, audience targeting, AI preview, publication rules).
   - Inline AI assistance to generate highlights, captions, and tags; allow manual override.
   - Support drafts with auto-save and resume.

2. **Validation Rules**
   - Audience `ListingAudience` enum validation; enforce women-first segmentation.
   - Maximum media files per listing with type/size restrictions; safe HTML sanitisation.
   - Conditional fields (e.g., partnership intent requires summary payload).

3. **Publication Workflow**
   - Agent must be verified; trigger `WomenListingPublished` event.
   - AI moderation run (Trust Shield pipeline); listing held in review if flagged.
   - Social boost options (opt-in to external share, schedule selection).

## 3. Media Handling

- `WomenListingMedia` supports images, videos, documents; stored in secure buckets with signed URLs.
- Processing pipeline: upload → queue for optimisation/transcoding → update media metadata (dimensions, duration, caption).
- Primary media selection influences listing hero display and social preview cards.

## 4. Audience & Targeting

- `WomenListingAudiencePivot` manages multi-audience tags (students, investors, partnership).
- AI suggests additional audience tags based on description; user can accept/reject.
- Feed filters respect audience restrictions (women-only visibility enforced at policy level).

## 5. Partnership Intents

- `WomenListingPartnerIntention` records users interested in co-living, co-buying, or co-developing.
- Intent flows:
  - Listing owner can review partner requests, accept/decline, or invite others.
  - Accepted partners move into `WomenPartnerProject` workspace (Step 14 integration).
- Provide templates for partnership agreements, due diligence checklists, and chat introductions.

## 6. Social Sharing Integration

- After publish, queue `SocialAmplificationJob` to generate share assets (images, captions, hashtags).
- Track share metrics in `WomenListingSocialShare` and display in dashboards.
- Allow scheduling repeat shares (e.g., weekly highlight) and cross-posting to multiple channels.

## 7. Analytics & Insights

- Enhance `WomenListingAnalyticsService` with new metrics (audience engagement, partnership conversion, mortgage widget usage).
- Cache invalidation on listing update; support filterable analytics by intent, agent, audience, publication status.
- Provide real-time trend cards in agent dashboard (Active vs. trending listings).

## 8. Testing & QA

- Feature tests for listing CRUD, partnership intent submission, and publish workflow guardrails.
- Livewire tests covering wizard steps, media uploads (using temporary files), AI fallback scenarios.
- Policy tests for listing visibility and partner interactions.
- Performance testing for listing index (pagination, filtering, caching).

## 9. Documentation & Support

- Update user-facing guides explaining listing requirements, media best practices, partnership etiquette.
- Provide admin runbooks for moderation, dispute handling, and partnership escalations.
- Extend developer docs with API endpoint usage, event references, and webhook formats for external partners.

## 10. Open Questions

- Should partnership intents require identity verification beyond account creation?
- Do we support joint listing ownership for co-listers at launch?
- Any legal templates required for partnership agreements, and who provides them?
- Strategy for auto-expiring stale listings or partnership requests?
