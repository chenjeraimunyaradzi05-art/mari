# ADR 0001: Domain-Oriented Namespace Foundation

- **Date:** 2025-11-11
- **Status:** Accepted
- **Deciders:** WomenRise platform team
- **Technical Story:** Integration Plan – Phase 1 follow-up

## Context

The current Laravel 11 application has grown organically with most business logic concentrated under `app/Services` and `app/Models`. Upcoming integration phases introduce new domains (RealEstateWomen, MortgageAI, AgentPortal, EducationHub) along with AI-driven workflows. A previous experiment (`dzimba/`) explored using the Nwidart module system, but the primary codebase remains a single application namespace (`App\`). Without a clear structure, onboarding new features risks cross-cutting concerns, duplicated logic, and unclear boundaries between domain capabilities.

## Decision

Adopt a domain-oriented namespace strategy rooted in Laravel's native autoloading. We will:

1. Introduce an `app/Domains/` directory, registering the PSR-4 namespace `App\Domains\`.
2. Group feature code (actions, DTOs, services, Livewire components, policies) beneath domain-specific sub-namespaces, e.g., `App\Domains\Housing\`, `App\Domains\Mortgages\`, `App\Domains\Partnerships\`.
3. Keep cross-domain infrastructure (jobs, events, helpers) under existing Laravel conventions unless a domain-specific implementation is required.
4. Use explicit contracts or facades when domains communicate, avoiding circular dependencies between namespace roots.

This approach preserves Laravel's simplicity while providing clear domain boundaries for upcoming work, without reintroducing the operational overhead of third-party module packages.

## Alternatives Considered

- **Nwidart/laravel-modules revival:** Rejected due to increased maintenance overhead, duplication of configuration, and lack of current adoption in the main app.
- **Status quo (flat `App\Services` growth):** Rejected because it obscures domain ownership and complicates phased delivery for housing, mortgage, and partnership features.

## Consequences

- Composer autoload must map `App\Domains\` to `app/Domains/` (completed alongside this ADR).
- Future features should target domain folders first, falling back to legacy locations only when unavoidable.
- Existing services that remain globally scoped should gradually be relocated or wrapped by domain-specific coordinators during subsequent phases.
- Documentation and onboarding materials must reference the new structure to keep contributors aligned.

## Follow-Up Actions

1. Seed initial domain directories (`Housing`, `Mortgages`, `Partnerships`, `Education`) with README stubs describing their scope.
2. Incrementally migrate housing-related services (e.g., listing verification, incident workflows) into `App\Domains\Housing` as we execute Phase 2 and beyond.
3. Update testing guidelines to mirror the namespace layout (e.g., `tests/Domains/Housing`).
