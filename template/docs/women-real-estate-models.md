# Women Real Estate Domain Models

This note captures the initial Eloquent model layer for the women-focused real estate feature set. Each model lines up with the schema introduced in `database/migrations/2025_11_12_110000_create_women_real_estate_tables.php`.

## WomenListing

- Table: `women_listings`
- Enum casts for `intent` and `primary_audience` using the domain enums.
- JSON casts for AI data (`ai_insights`, `audience_overrides`, `features`).
- Relationships: `owner`, `agent`, `category`, `location`, `media`, `audiences`, `mortgageSnapshots`, `socialShares`, `partnerIntentions`.
- Computed accessor `audience_values` returns a collection of `ListingAudience` enums derived from the pivot records.

## Auxiliary Listing Models

- **WomenListingCategory** — catalogues category metadata. Has many listings.
- **WomenListingLocation** — hierarchical geography with self-referencing parent / child relations and location-level listings.
- **WomenListingMedia** — ordered media assets with JSON metadata.
- **WomenListingAudiencePivot** — pivot rows that cast `audience` back into `ListingAudience` enums.
- **WomenListingMortgageSnapshot** — denormalised mortgage data per listing; links to market rates.
- **WomenListingSocialShare** — audit trail of external shares per user / platform.
- **WomenListingPartnerIntention** — records partner invites with preference payloads.

## Agent & Lead Models

- **WomenVerifiedAgent** — wraps licensed agent verification details with JSON payload storage.
- **WomenAgentLead** — lead capture for verified agents linking optionally back to listings and users.

## Market Rate Model

- **WomenMortgageMarketRate** — canonical reference for market products. Casts `source` to the `MortgageRateSource` enum and normalises rate decimals.

With these models in place, we have a cohesive domain layer to build policies, observers, factories, and Livewire endpoints in subsequent increments.

## Factory Coverage

- `database/factories/WomenRealEstate/WomenListingFactory.php` seeds full listing graphs, including optional media and mortgage snapshot helpers plus automatic audience pivot creation.
- Supporting factories exist for categories, locations, verified agents, market rates, snapshots, social shares, partner intentions, and agent leads to streamline future tests and scenario seeding.
- Helper states such as `published()`, `verified()`, and `withMedia()` make it easy for downstream teams to compose realistic fixtures quickly.

## Seeder Refresh

- `database/seeders/WomenRealEstateSeeder.php` now relies on the new factory suite to populate demo data, generating curated categories, metro/suburb hierarchies, verified agents, listings, social signals, and captured leads within a single transaction.

## Policy & Observer Outline

- `app/Policies/WomenRealEstate/WomenListingPolicy.php` centralises authorisation around listing ownership, agent assignment, and publish actions that require a verified agent.
- `app/Observers/WomenRealEstate/WomenListingObserver.php` defends the publish and verification flags at the model layer.
- `app/Observers/WomenRealEstate/WomenVerifiedAgentObserver.php` keeps agent timestamps in sync and automatically downgrades listings if an agent loses verified status.
