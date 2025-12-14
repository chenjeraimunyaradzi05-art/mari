# Women Real Estate Platform — Social Amplification Build Plan (Step 18)

## 1. Objectives

- Implement social amplification workflows outlined in Step 06, spanning content creation, scheduling, distribution, and analytics.
- Integrate AI captioning, moderation, and referral tracking to boost reach while maintaining community safety.

## 2. Content Generation Pipeline

1. **Trigger Points**
   - Listing publish or update events.
   - Agent/partner milestones (verification success, project launch).
   - Learner achievements (goal milestones, grant approvals).

2. **AI Captioning**
   - Use `AIWorkflowOrchestrator` with Social pipeline to generate caption variants (motivational, informative, investment).
   - Provide editing UI for agents/admin to tweak captions before publishing.
   - Store versions in `WomenListingSocialShare` for audit and reuse.

3. **Asset Preparation**
   - Generate social preview images using listing media templates (overlay branding, verified badge).
   - Provide short highlight videos via `VideoAnalysisService` for posts on TikTok/Instagram (phase 2).

## 3. Scheduling & Distribution

- Implement scheduler UI enabling agents to select networks, schedule time, and target audiences.
- For API-enabled platforms (LinkedIn, Facebook), integrate via queued jobs with OAuth token storage.
- For manual platforms (Instagram Reels), provide share pack (caption + assets) with copy buttons.
- Support recurring campaigns (weekly highlights) with template selection.

## 4. Referral & Engagement Tracking

- Generate unique share links with referral parameters tied to user/agent.
- Track click-through and conversion actions (lead sign-up, partner request).
- Display metrics in agent dashboard (impressions, CTR, conversion rate, referrals rewarded).

## 5. Safety & Moderation

- Run captions and uploaded assets through `TrustShield` pipeline before scheduling.
- Provide review queue for flagged content; moderators can approve/edit/deny.
- Log moderation decisions and AI confidence in `WomenListingSocialShare` metadata.

## 6. Notifications & Feedback

- Notify agents when scheduled posts go live and when significant engagement occurs.
- Allow subscribers to opt into digest emails showcasing top women-led listings/projects.
- Collect feedback from recipients (thumbs up/down) to refine AI captions and scheduling heuristics.

## 7. Analytics Dashboard

- Build Livewire component `Livewire\Agents\SocialPerformance` with charts (impressions, engagement rate, shares by platform).
- Provide timeline of social activity, top-performing content, optimal times recommendations.
- Integrate with Step 10 analytics framework for centralised reporting.

## 8. Testing Strategy

- Feature tests for scheduling flow, ensuring validation of platform tokens and moderation gate.
- Integration tests with mocked external APIs for posting.
- Livewire tests verifying dashboard metrics update from analytics service.
- AI caption snapshot tests to ensure prompt changes tracked.

## 9. Rollout Plan

1. Internal beta with curated agents to validate captions and scheduling experience.
2. Expand to verified agents; gather feedback on UI and analytics insights.
3. Enable external platform integration gradually; start with LinkedIn (professional network), then extend to Instagram/TikTok.
4. Launch referral incentives with `GamificationService` support.

## 10. Open Questions

- Credential storage strategy for social platforms (encrypted vault, rotation schedule)?
- Do we support multi-language captions from day one?
- What incentives resonate most with agents for referrals (cash, credits, exclusive events)?
- Need for legal review of branded co-marketing posts?
