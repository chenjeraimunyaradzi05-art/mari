# ATHENA Business & Social Overview

**Status:** Strategic positioning brief  
**Last updated:** 2026-04-18

This document captures ATHENA's intended business model, market positioning, and social-product shape. It is a product strategy brief, not an implementation ledger. For current codebase readiness and documentation accuracy, also see [PLATFORM_DOCS_AUDIT_REPORT_2026-03-22.md](../PLATFORM_DOCS_AUDIT_REPORT_2026-03-22.md).

## Positioning & Vision

ATHENA is a career SuperApp for young professionals, with a women-first orientation, that brings job seeking, mentorship, education, community, and AI guidance into a single platform.

The product vision is to reduce fragmentation across a user's career journey by combining:

- opportunity discovery
- skill and career development
- professional identity and networking
- trusted community participation
- monetization pathways for mentors, creators, and employers

## Target Audience

ATHENA is designed for early- to mid-career professionals, approximately ages 25 to 50, with an especially strong focus on women navigating career growth, transitions, and economic mobility.

The platform serves three primary marketplace sides:

- **Job seekers:** professionals looking for roles, support, and career advancement
- **Creators and mentors:** experts who teach, coach, and monetize knowledge
- **Employers:** organizations hiring talent and building brand presence

## Business Model

### Subscription Tiers

| Tier | Price | Included |
|------|-------|----------|
| Free | $0 | Basic job search, community access, basic profile, 5 job applications per month |
| Pro | $29/month or $290/year | Unlimited applications, AI Resume Optimizer, Interview Coach (10/month), priority matches, 20% course discounts, 1 free mentor session/month, premium support |
| Enterprise | $99/month or $990/year | Everything in Pro plus team management, custom job boards, analytics dashboard, SSO/SAML, API access, dedicated account manager, 24/7 support |

### Promotions & Access

- 14-day free trial for Pro
- 50% discount for verified nonprofits
- 50% discount for verified students

### Revenue Levers

- Recurring subscriptions
- Mentor session booking fees
- Course sales
- Job promotion fees
- Enterprise seats and account expansion
- Custom integrations and employer branding packages

## Core Product Pillars

### 1. Job Seeker Experience

- AI-powered job matching and recommendations
- Resume builder with AI suggestions
- Interview preparation coach
- Salary transparency tools
- Professional networking

### 2. Employer Experience

- Job posting and applicant management
- AI-assisted candidate screening
- Employer branding tools
- Company culture showcase

### 3. Creator & Mentor Economy

- Course creation platform
- Bookable mentorship sessions
- Monetization tooling
- Video content hosting

### 4. Community & Social Layer

- Professional groups and events
- Direct and group messaging
- Content feed with engagement mechanics
- Badges, streaks, and gamification
- Unified search across jobs, people, groups, content, and learning

## Social & Engagement Mechanics

ATHENA's engagement model is intended to support daily return behavior rather than one-time transactional usage.

### Groups & Events

- Public and private groups
- Virtual and in-person events
- RSVP flows and attendance tracking

### Messaging

- Real-time direct chat
- Group conversations
- Presence indicators

### Feed

- Social posts
- Job shares
- Course and mentor highlights
- Likes, comments, and lightweight engagement loops

### Gamification & Retention

- Achievement badges
- Leaderboards
- Usage streaks
- Referral codes with credits for both referrer and referred user
- In-app and push notifications for applications, messages, matches, and events

## Technology & Operations

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Search | OpenSearch 2.11 |
| ML Services | Python, FastAPI |
| Mobile | React Native with Expo |
| Infrastructure | Docker, Terraform, AWS |
| Web Hosting | Netlify |
| Backend Hosting | Railway |
| Payments | Stripe |
| Auth | 15-minute JWT access token with rotating 7-day HttpOnly refresh cookie |

## Compliance, Safety & Regionalization

ATHENA is intended to scale with privacy, safety, and international operations built into the product model.

### Compliance & Privacy

- GDPR-aligned data practices
- DSAR export workflows
- Consent management
- Cookie preferences
- Audit trails and admin activity logging

### Safety

- Reporting workflows
- Blocking tools
- Safe mode controls
- Admin moderation support

### Regionalization

- Region-specific pricing
- Localized payment methods
- Localized legal documents and consent surfaces

Supported payment method strategy includes global and regional options such as PayPay, UPI, Pix, OXXO, Mercado Pago, and KakaoPay where commercially appropriate.

## Competitive Differentiators

- Women-first positioning designed to reduce noise and improve relevance for the core audience
- Integrated AI coach across matching, resumes, and interview preparation
- SuperApp model that combines professional, social, learning, and business workflows
- Live mentor marketplace with embedded booking and payments
- Compliance- and privacy-aware architecture for global expansion

## Growth Loops

### Marketplace Density

Each additional user improves the platform's matching data, content relevance, and marketplace liquidity.

### Creator Supply Loop

Mentors and creators add supply-side value through courses, sessions, and repeatable content, making the platform more useful for job seekers.

### Enterprise Flywheel

Team and employer adoption introduces multiple participants at once, deepening marketplace density and data quality.

### Engagement Loop

Notifications, recognition systems, referrals, and social participation encourage return usage and organic acquisition.
