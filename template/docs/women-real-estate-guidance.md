# Women Real Estate Guidance Playbook

## 1. Purpose

- Align every women-first housing touchpoint (JourneyHub, persona wizard, dashboards, AI helpers) with a single tone of care, safety, and clarity.
- Provide engineering + CX teams with actionable guardrails that map directly to the Laravel codebase (Livewire modules, services, config flags).
- Ensure mortgage education, trust-building, and social amplification stay informational (not advice) while remaining measurable.

## 2. Core Personas & Where They Live

| Persona Constant | Label (UI) | Primary Surfaces | Key Needs |
| --- | --- | --- | --- |
| `househunter` | Renter / Seeker | JourneyHub renter path, persona wizard, seeker dashboards | Safety filters, budget clarity, relocation support |
| `buy` / `investor` | Buyer / Investor | JourneyHub buy path, mortgage widgets, partner dashboards | Deposit planning, rate comparisons, mentor network |
| `lease` / `landlord` | Landlord / Host | Listing console, media locker, impact reporting | Publishing rules, safety commitments, tenant matching |
| `agent` | Licensed Agent / Advocate | Verification wizard, referrals feed, compliance console | Regulator proof, trust metrics, social badges |
| `student` | Student / Graduate | Learner dashboard, cohort modules | Time-poor prompts, budget tools, wellbeing blend |
| `entrepreneur` | Entrepreneur / Founder | Business hub, partner marketplace | Space suitability, storage/logistics, investor intros |

> Reference: `App\Models\WomenRealEstate\WomenPersonaProfile::PERSONAS`

## 3. Experience Pillars

### 3.1 JourneyHub Pathway Guidance

- **Component**: `App\Livewire\WomenRealEstate\Onboarding\JourneyHub`
- **Contract**: Each path needs one "profile" shortcut, one media task, and one community connection target. Copy must explicitly restate safety and equity promises.
- **Path selection**:
  - `rent` → show Househunter profile, highlight renter safety filters.
  - `lease` → expose Listing console CTA and remind about women-first publishing requirements.
  - `buy` → require financing plan toggle (`cash` vs `mortgage`) and tee up calculators.
  - `agent` → fast-track verification CTA and emphasise regulator references.
- **Persona coach panel**: Pull hints from `WomenPersonaAiService::personaCoachingTips` whenever requirements are incomplete to remind members what remains.
- **Telemetry**: Fire `realEstateProfileProgress`, `realEstateMediaProgress`, `realEstateSocialProgress` Livewire events so analytics can watch drop-off per step.

### 3.2 Persona Wizard Guidance

- **Component**: `App\Livewire\WomenRealEstate\Personas\Wizard`
- **Schema**: Sections `identity`, `household`, `lifestyle`, `work`, `transport`, `media`. All store encrypted JSON inside `women_persona_profiles`.
- **AI helpers**:
  - *Story Builder* → `WomenPersonaAiService::buildStorySummary` (cache TTL 30m) summarises member notes. Provide fallback copy if AI unavailable.
  - *Trust Coach* → `trustCoachChecklist()` surfaces three micro-actions tied to `sectionProgress`. Always fall back to deterministic checklist sorted by lowest-complete section.
  - *Persona Coach Nudges* → uses config hints at `config/women_real_estate.php → persona_profiles.hints`. Always label provider (e.g. OpenAI, Anthropic, fallback).
- **Guidance goals**:
  1. Hit the premium threshold (`config('women_real_estate.persona_profiles.premium_threshold')`, default 80) to unlock discovery badges.
  2. Keep visibility controls explicit per field (private/network/public) and default to `network` unless explicitly public.
  3. Encourage uploading at least one featured media asset (`women_user_media` table) to earn trust in the feed.
- **Enhancement scope (this task)**: add readiness signals (story, media, trust, premium) so members see what is missing without opening modals.

### 3.3 Mortgage & Finance Guidance

- **Services**: `App\Services\Mortgage\MortgageScoringService`, `RepaymentCalculatorService`, `App\Services\WomenRealEstate\Ai\WomenPersonaAiService` (`mortgage_guidance` flow).
- **UX hooks**:
  - Mortgage widget should always pair numeric repayments with narrative guidance + disclaimers: "Informational only, not a credit offer."
  - When JourneyHub `path === 'buy'`, show financing toggle copy that references calculators and grant checklist.
  - Feed persona wizard identity/work fields back into mortgage guidance prompts for tone and context (income stability, wellbeing focus, accessibility notes).
- **Data contracts**: `women_mortgage_market_rates` snapshots (example rates) + `women_listing_mortgage_snapshots` per listing. Never store personal financial advice; only share scenario outputs.

### 3.4 Social & Discovery Guidance

- **Highlight path**: `highlight_in_feed` + `auto_share_opt_in` booleans on `WomenPersonaProfile` gate whether the social feed team can spotlight the member.
- **Media locker**: `WomenUserMedia` assets (max 40 pulled into wizard) should be tagged with captions and type to drive safe auto-sharing.
- **Analytics**: log persona completion milestones (`PersonaProfileUpdated` event) and tie to Women Real Estate caches so JourneyHub progress stays accurate.
- **Content safety**: Generated captions must pass the moderation provider order defined in `config('women_real_estate.ai.flow_provider_order.moderation_review')` before scheduling.

## 4. Operational Guardrails

- **Feature flags**: `config('women_real_estate.features')` toggles (e.g., `core`, `mortgage_engine`, `agent_verification`). Guard UI entry points and queue jobs with the same flag to avoid broken flows.
- **Caching**: Persona AI helpers respect TTLs under `config('women_real_estate.ai.cache_ttl.*')`. When forcing refreshes ("Refresh tips"), bypass caches intentionally and rate-limit requests.
- **Privacy**: Identity + household payloads use `App\Casts\EncryptedJson`. Avoid dumping entire arrays to logs; read with `Arr::get($profile->identity, 'field.value')` instead.
- **Events**: After saving persona data call `$profile->markUpdated()` so downstream analytics, listings, and feed caches refresh.
- **Testing**: Extend `tests/Feature/Livewire/WomenRealEstate/PersonaWizardTest.php` whenever new UX logic (e.g., readiness signals) is introduced.

## 5. Implementation Checklist

1. **JourneyHub copy**: confirm each path restates benefits + CTA (see `pathDefinitions()` helper).
2. **Persona readiness signals**: compute after every form change so the new guidance card never drifts from reality.
3. **Mortgage hints**: ensure `MortgageGuidanceService` outputs include disclaimers and telemetry hooks.
4. **Media coverage**: keep `loadMediaOptions()` limit at 40 items to avoid Livewire payload bloat; paginate later if required.
5. **Analytics**: emit `realEstateProfileProgress` events with a `signals` integer (completion score ÷ 10) for JourneyHub progress bars.
6. **Docs**: mirror UX changes here and in `docs/women-real-estate-views-components-rfc.md` so design + engineering stay in sync.

## 6. Next Steps

- Wire the new persona wizard readiness card to the JourneyHub dashboard so a member’s status is visible without re-entering the wizard.
- Connect mortgage guidance AI outputs to readiness signals (story + trust) so members understand how mortgage prep and persona storytelling reinforce each other.
- Expand this playbook with agent- and landlord-specific guidance once verification + listing consoles finish QA.
