# Home & Member Dashboard Redesign — Step 1 (Scoping 10%)

Date: 2025-11-09  
Reference: `moneyman-v3.0-COMPLETE.md`

## 1. Strategic Objectives

- Elevate the home experience to surface the four platform pillars (Recruitment + Social, Education & Apprenticeships, Advertising, Strategic Innovations) with luxury positioning.
- Align the member dashboard with the onboarding dashboard tone: transparent, action-first, and AI-guided.
- Prepare for vertical-specific journeys (Yachting, Luxury Hospitality, Aviation, Tech, Finance, Healthcare) without overwhelming first-time visitors.

## 2. Gap Analysis (Current vs Required)

### Home Menu & Landing Flow

- **Navigation depth:** Current menu is flat, lacks pillar segmentation; no quick access to Apprenticeships, Education, Advertising, or Strategic Innovations.
- **Hero CTA mix:** Hero focuses on job search; needs dual CTA stack (Join WomenRise, Discover Apprenticeships, Explore Mentorship, Advertise with Us).
- **Social proof:** Testimonials exist, but not aligned with vertical excellence (e.g., superyacht crew, luxury hospitality managers).
- **Vertical discovery:** No pathways to high-value vertical hubs or premium organisation stories.
- **AI narrative:** AI sections exist but feel generic; missing "Career Intelligence Engine" storytelling.

### Member Dashboard

- **Onboarding continuity:** Progress tracker strong, but dashboard copy does not echo persona guidance or support nudges from onboarding.
- **Pillar surface area:** Lacks direct entry to Apprenticeships, Education pathways, Advertising (Creator/Influencer) opportunities, or Strategic Innovations labs.
- **Vertical personalisation:** AI job matches not categorised by vertical; no quick view into apprenticeship slots or education matches.
- **Revenue levers:** No prompts for premium CV reviews, coaching, or content creation rewards.
- **Metrics storytelling:** Existing metrics focus on profile completeness; need north-star metrics (Career trajectory score, Learning momentum, Network strength).

## 3. Proposed Information Architecture (High-Level)

### Home Experience Adjustments

1. **Top Navigation:**
   - Pillars menu: `Careers`, `Education`, `Apprenticeships`, `Community`, `Advertise`.
   - Utility links: `Login`, `Join WomenRise`, `For Employers`, `For Educators`.
2. **Hero Stack:**
   - Primary CTA buttons: `Join WomenRise`, `Find Apprenticeships`, `Explore Career Intelligence Demo`.
   - Secondary link: `See how WomenRise powers luxury hospitality careers`.
3. **Pillar Highlights:**
   - Four-card band with iconography, CTA, and success metric per pillar.
4. **Vertical Gateways:**
   - Carousel or grid with vertical badges (Yachting, Luxury Hospitality, Aviation, Tech, Finance, Healthcare) linking to curated landing pages.
5. **AI Career Intelligence Strip:**
   - Snapshot of predictive analytics (e.g., "Your 5-year trajectory", "Skill gap radar").
6. **Creator & Advertiser Promo:**
   - Section inviting brands and creators to advertise or publish content (CPM/CPC/CPA overlays).

### Member Dashboard Adjustments

1. **Welcome Band:**
   - Replace static copy with AI insight: "Your Career Intelligence Pulse" showing percentage progress toward desired role path.
2. **Persona Echo Cards:**
   - Surface top three persona nudges (from onboarding) with direct CTAs.
3. **Vertical Spotlight:**
   - Tile deck for recommended verticals, each showing open roles, apprenticeship slots, and learning modules.
4. **Career Momentum Metrics:**
   - New KPIs: `Trajectory Score`, `Learning Hours Logged`, `Network Reach`, `Content Influence`.
5. **Opportunity Streams:**
   - Tabs for `Jobs`, `Apprenticeships`, `Courses`, `Mentorship`, `Creator Earnings` fed by AI matches.
6. **Revenue Hooks:**
   - Prompts for premium services (AI CV critique, Interview coach, Creator monetisation).

## 4. Data & Service Dependencies (Backlog Draft)

- **Career Intelligence API:** Expanded endpoints for trajectory score, learning recommendations, vertical prioritisation.
- **Apprenticeship Catalog Service:** Access to program metadata (eligibility, intake windows, subsidies).
- **Education Catalog Integration:** Courses, mode, provider, pricing, scholarship data.
- **Advertising Inventory Feed:** Featured campaigns, creator payouts, CPM/CPC metrics.
- **Persona Sync:** Share persona selections and nudges with dashboard widgets via API (current onboarding endpoints).
- **Vertical Content Blocks:** Data models for vertical stories, testimonials, video highlights.

## 5. Next Steps (Step 2 Preview)

1. Wireframe annotated layouts for updated home hero, pillar band, and vertical gateway.
2. Draft component contracts (Blade/Livewire/Vue) mapping to data dependencies.
3. Identify feature flags or phased rollout strategy for each new section.
