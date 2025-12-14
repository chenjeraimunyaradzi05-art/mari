# Women Real Estate Platform — Domain Implementation Plan (Step 12)

## 1. Objective

Establish the core domain layer (models, enums, policies, observers, factories) aligned with the new schema and business rules while maintaining test coverage and static analysis compliance.

## 2. Workstreams

1. **Model Enhancements**
   - Update `WomenListing`, `WomenVerifiedAgent`, `WomenListingMortgageSnapshot`, `WomenMortgageMarketRate` with new attributes (trust score, AI insights, social metrics).
   - Introduce new models: `WomenAgentVerificationAudit`, `WomenCohortProfile`, `WomenCohortEnrolment`, `WomenPartnerProject`, `WomenPartnerMatch`, `WomenGoalTracker`, `AIInferenceLog`.
   - Define relationships, casts, accessors, scopes consistent with Step 07 schema.

2. **Domain Services & Aggregates**
   - Extend existing services (`WomenListingAnalyticsService`, `MortgageRepaymentService`, `MortgageSnapshotIngestionService`, `WomenListingAnalyticsService`) to consume new relationships and attributes.
   - Introduce coordinators (`WomenVerificationService`, `WomenCohortService`, `WomenPartnerMatchingService`) encapsulating orchestration logic.

3. **Policies & Gates**
   - Implement policies outlined in Step 08 using `php artisan make:policy` with full ability mapping.
   - Register in `AuthServiceProvider`; ensure `Gate::before` for super-admin bypass.
   - Write policy tests covering key scenarios (owner vs. admin, verified vs. non-verified, persona restrictions).

4. **Observers & Events**
   - Create observers for `WomenListing`, `WomenVerifiedAgent`, `WomenCohortProfile` to manage publish rules, trust score recalculations, and AI metric invalidation.
   - Hook into `EventServiceProvider` with domain events (publish, verification, partner match) for asynchronous processing.

5. **Factories & Seeders**
   - Refresh factories to include new fields and nested relationships using states (e.g., `withMortgageSnapshot`, `withPartnerMatch`).
   - Update seeders to use new factories; ensure reproducible data for tests.

6. **Enums & Value Objects**
   - Expand existing enums or create new ones (`VerificationStage`, `PartnerIntentType`, `GoalType`, `CohortPersona`).
   - Provide convenience methods (`labels()`, `descriptions()`) for UI/UI copy.

## 3. Static Analysis & Coding Standards

- Update PHPStan baseline after adding new classes; maintain level 9 compliance.
- Enforce strict types, typed properties, and docblocks for complex arrays.
- Run Psalm (if integrated) to ensure no regressions; fix false positives early.

## 4. Testing Strategy

- Unit tests per model validating casts, relationships, scopes.
- Policy tests verifying allow/deny matrix under various contexts.
- Observer tests ensuring side effects (cache invalidation, status toggles).
- Service tests mocking dependencies (AI services, notifications) to verify orchestrators.
- Factories tested by creating models and asserting data integrity.

## 5. Documentation & Developer Experience

- Update model reference doc (`docs/women-real-estate-models.md`).
- Generate fresh PHPDoc via `php artisan ide-helper:models` if used.
- Add README section for new domain folder (`app/Domains/WomenRealEstate`).
- Provide example workflows in documentation for onboarding new contributors.

## 6. Rollout Considerations

- Feature flag orchestrator usage to allow gradual activation.
- Coordinate with Step 11 branch; merge migrations first, then domain logic.
- Monitor staging logs for policy denials and observer events to catch misconfigurations.

## 7. Open Questions

- Should AI inference log be global or namespaced per domain? (Impacts model namespace.)
- Handling cross-domain relationships (e.g., partner projects linking to existing organisations) — decide now or iterate later.
- Do we need domain events for goal tracker milestones or reuse existing tracking services?
