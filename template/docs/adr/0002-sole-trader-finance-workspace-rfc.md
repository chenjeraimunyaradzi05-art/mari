# RFC 0002 — Sole-Trader Finance Workspace

**Author:** GitHub Copilot (GPT-5.1-Codex, pairing with Munyaradzi Chenjerai)  
**Date:** 2025-11-23  
**Status:** Draft for review  
**Related Docs:** implementation-summary.md, athena-comprehensive-plan.md, moneyman-updated.md, tmp/Problem map.txt, tmp/Critical Problems Women Face.txt

---

## 1. Summary

The banking inbox now delivers live feeds, AI bulk actions, and concierge hand-offs. Sole traders and micro-business members still lack a calm workspace for day-to-day budgeting, cash tracking, and exportable statements. This RFC introduces:

- A first-class **Business Cashbook** data model with entries, budgets, and AI metadata.  
- A **Business Finance API surface** for CRUD, summarisation, exports, and AI helpers.  
- **Background jobs** for AI categorisation and export preparation.  
- A **Vue/Laravel workspace** layout with budgeting tables, cashflow chart, CSV/PDF buttons, and AI-insight rail.  
- Decisions on **CSV/PDF export stack** and **charting library**.

## 2. Goals & Non-Goals

### Goals

- Persist structured cashbook data separate from `bank_transactions` but linkable later.  
- Offer request/response contracts that mirror existing bank-feed patterns (filters, pagination, bulk ops).  
- Enable one-click CSV/PDF exports for accountants.  
- Surface AI categorisation and conversational helpers using the `business-accounting` context prompt.  
- Ship a responsive workspace with budgeting tables + cashflow charts.

### Non-Goals

- Full double-entry bookkeeping or GST/BAS filing logic.  
- Automated bank-feed → cashbook reconciliation (future).  
- Multi-entity consolidation (single user scope for v1).  
- Mobile-native clients (web-first, but responsive).

## 3. Architecture Overview

### 3.1 Data Model (ERD)

```text
+------------------------+        +-----------------------------+
| business_cashbooks     |1      *| business_cashbook_entries   |
|------------------------|        |-----------------------------|
| id (PK)                |<------>| id (PK)                     |
| user_id (FK -> users)  |        | business_cashbook_id (FK)   |
| name                   |        | date                        |
| entity_type ENUM       |        | entry_type ENUM (income/exp)|
| currency               |        | category                    |
| is_default BOOL        |        | description                 |
| start_date             |        | amount DECIMAL(12,2)        |
| notes TEXT             |        | is_tax_deductible BOOL      |
| metadata JSON (future) |        | ai_last_context_token UUID? |
| timestamps             |        | ai_last_context_at DATETIME |
|                        |        | metadata JSON               |
+------------------------+        | reviewed_by_ai BOOL         |
                                  | timestamps                  |
                                  +-----------------------------+

+--------------------------+      +----------------------------+
| business_budgets         |1    *| business_budget_lines      |
|--------------------------|      |----------------------------|
| id (PK)                  |<---->| id (PK)                    |
| business_cashbook_id FK  |      | business_budget_id FK      |
| period_start DATE        |      | line_type ENUM (income/exp)|
| period_end DATE          |      | category                   |
| title                    |      | label                      |
| currency                 |      | planned_amount DECIMAL     |
| auto_rollover BOOL       |      | notes                      |
| timestamps               |      | sort_order INT             |
                              | timestamps                 |
                              +----------------------------+
```

### Relationships

- `User` has many `BusinessCashbook`; one default per member.  
- `BusinessCashbook` has many `Entries` and `Budgets`.  
- `BusinessBudget` has many `BudgetLines`.  
- Future link: `bank_transactions.id` stored inside `entries.metadata.source_ids` for reconciliations.

### 3.2 Naming & Indexing

- Index `business_cashbooks (user_id, is_default)` for quick lookup.  
- Index `business_cashbook_entries (business_cashbook_id, date)` for chart queries.  
- Index `business_budget_lines (business_budget_id, line_type)` for summary splits.

## 4. API Surface

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/v1/business/cashbook` | Fetch default cashbook; auto-create if missing. |
| PATCH | `/api/v1/business/cashbook` | Rename cashbook, switch entity type, toggle default. |
| GET | `/api/v1/business/cashbook/entries` | List entries with filters (date range, type, category, search, pagination). |
| POST | `/api/v1/business/cashbook/entries` | Create entry (single). |
| PATCH | `/api/v1/business/cashbook/entries/{id}` | Update entry. |
| DELETE | `/api/v1/business/cashbook/entries/{id}` | Soft-delete entry. |
| POST | `/api/v1/business/cashbook/entries/bulk` | Bulk actions: delete, reclassify, toggle tax flag. |
| GET | `/api/v1/business/cashbook/summary` | Return aggregates (income, expense, burn, runway). |
| POST | `/api/v1/business/cashbook/ai-suggest` | Request AI categories for selected entries. |
| POST | `/api/v1/business/cashbook/ai-context` | Build AI concierge payload akin to bank feed. |
| GET | `/api/v1/business/budgets` | List budgets by period. |
| POST | `/api/v1/business/budgets` | Create/update budget & lines in one payload. |

| GET | `/api/v1/business/cashbook/export` | Kick off CSV/PDF export job (query params: format, date range). |

### Request/Response Shapes

#### List entries

```http
GET /api/v1/business/cashbook/entries?from=2025-10-01&to=2025-10-31&type=income&page=1
```

```json
{
  "data": [
    {
      "id": 421,
      "date": "2025-10-14",
      "entry_type": "income",
      "category": "consulting",
      "description": "Retainer — Shoreline Studio",
      "amount": 4200.00,
      "is_tax_deductible": true,
      "ai": {
        "last_context_token": "a4b1f502-...",
        "last_context_at": "2025-10-14T05:21:00Z",
        "suggested_category": "Consulting Income",
        "confidence": 0.82
      },
      "metadata": {
        "source": "manual",
        "bank_transaction_ids": [1192]
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 25,
    "total": 68,
    "filters": {"from": "2025-10-01", "to": "2025-10-31", "type": "income"}
  }
}

```

#### Create entry

```json
POST /api/v1/business/cashbook/entries
{
  "date": "2025-11-20",
  "entry_type": "expense",
  "category": "software",
  "description": "Figma subscription",
  "amount": 33,
  "is_tax_deductible": true,
  "metadata": {"vendor": "Figma", "notes": "Team plan"}
}

```

Response `201 Created` with entry resource payload above.

#### Summary

```json
GET /api/v1/business/cashbook/summary?period=month&anchor=2025-11-01
{
  "totals": {
    "income": 12250,
    "expenses": 8840,
    "net": 3410,
    "runway_weeks": 11.3
  },
  "series": {
    "cashflow": [
      {"label": "Week 1", "income": 3200, "expenses": 2100},
      {"label": "Week 2", "income": 2800, "expenses": 1900}
    ],
    "category_breakdown": [
      {"category": "software", "amount": 330},
      {"category": "travel", "amount": 740}
    ]
  },
  "budget_comparison": {
    "planned_income": 14000,
    "planned_expenses": 9000,
    "variance_income": -1750,
    "variance_expenses": -160
  }
}

```

#### Export request

```http
GET /api/v1/business/cashbook/export?format=pdf&from=2025-07-01&to=2025-09-30
```

```json
{
  "job_id": "exp_017d9d4c",
  "status": "queued",
  "expires_at": "2025-12-23T11:00:00Z"
}

```

Follow-up endpoint (shared with other exports) returns signed URL once complete.

#### AI Suggest

```json
POST /api/v1/business/cashbook/ai-suggest
{
  "entry_ids": [421, 422],
  "context": {
    "business_stage": "sole_trader",
    "notes": "Owner is on the $75k GST threshold"
  }
}

```

Response includes per-entry suggestions plus context payload for concierge.

## 5. Background Jobs & Queue Plan

| Job | Trigger | Queue | Purpose |
|-----|---------|-------|---------|
| `ProcessBusinessCashbookExport` | `/export` request | `exports` | Generate CSV/PDF asynchronously, upload to S3, emit event once ready. |
| `CategorizeBusinessEntriesWithAI` | Manual button or nightly batch | `ai` | Chunk entry IDs, call OpenAI/Claude via `AthenaAIService` with `business-accounting` prompt, persist suggestions + tokens. |
| `SyncCashbookInsights` | Hourly schedule | `reports` | Precompute summary cache (week/month) for snappy dashboard loads. |
| `ReconcileCashbookSourceLinks` (future) | Bank-feed selection | `default` | Map manual entries to bank transactions for cross-highlights. |

All jobs emit `finance.*` events for telemetry; leverage existing queue workers defined in `supervisor.conf`.

## 6. UI Wireframe Callouts

```
+----------------------------------------------------------------------------------+
| Sticky Header: "Sole-Trader Finance"  [CSV ▼] [PDF ▼] [Ask Athena]              |
+---------------------------+------------------------------------+----------------+
| Left Rail (filters)       | Main Panel                          | Right Insights |
| - Account switcher        | 1. Net Cash Position card           | - AI assistant |
| - Date range preset       | 2. Cashflow Chart (line/area)       |   (contextual) |
| - Category chips          | 3. Budget vs Actual table           | - Alerts (tax) |
| - Tax flag toggle         | 4. Entry grid (inline edit)         | - Tips/stats   |
|                           | 5. Bulk actions toolbar             |                |
+---------------------------+------------------------------------+----------------+
| Bottom Sheet (mobile) with FABs: Add Entry, Import CSV, AI Categorize             |
+----------------------------------------------------------------------------------+
```text

```

### Callouts

1. **Cashflow Chart**: toggle weekly/monthly, stack income vs expense.  
2. **Budget Table**: two columns (planned vs actual) grouped by category; inline editing uses `BudgetingService`.  
3. **Entry Grid**: same interaction language as bank inbox (checkbox selection, pill statuses).  
4. **Right Rail**: AI helper shows latest suggestion, reasons, and CTA to open concierge with `context_payload`.  
5. **Export buttons**: dropdown selects date presets; stateful spinner while job queued.  
6. **Accessibility**: high-contrast focus states, keyboard shortcuts (e.g., `e` to add entry, `a` to launch AI).

## 7. Export & Reporting Decisions

- **CSV/Excel**: Adopt [`maatwebsite/excel`](https://github.com/Maatwebsite/Laravel-Excel) which is already common in Laravel ecosystems, supports streaming, chunked queries, and can emit XLSX if requested later.  
- **PDF**: Use [`barryvdh/laravel-dompdf`] for consistent Blade-to-PDF conversion; done previously in other modules, easy to theme with Tailwind PDF styles.  
- **Storage**: Upload exports to existing S3 bucket (`reports/finance/{user_id}/{job_id}.{ext}`) with 7-day expiry; signed URLs served through `/api/v1/exports/{job_id}`.

## 8. Charting Strategy

- **Library**: Chart.js 4 + `vue-chartjs` wrapper (already used in analytics dashboards). Reasons: small bundle, good annotation plugins, accessible defaults.  
- **Components**: `CashflowChart.vue`, `CategoryBreakdownDonut.vue`.  
- **Data Source**: `/summary` endpoint returns aggregated series in chart-ready format.  
- **Performance**: Debounce filter changes, lazy-load chart chunk via dynamic import.  
- **Theming**: Reuse Tailwind color tokens (`purple-500`, `pink-400`, `emerald-400`) for consistent Athena palette.

## 9. Observability & Security

- Log every write (`entry created/updated/deleted`, `budget saved`, `export requested`) with user + cashbook ID for audits.  
- Use policies to ensure users only touch their own cashbooks; guard all routes with Sanctum.  
- Mask sensitive notes in logs.  
- Emit metrics (`finance.entries.count`, `finance.ai.calls`, `finance.exports.duration`).  
- Reuse bank-feed rate limiting for AI endpoints (20 req/min/user).  
- Exports contain financial data → signed URLs + automatic purge after expiry.

## 10. Open Questions / Next Steps

1. **GST / Tax Settings**: Do we capture GST percentages now or later?  
2. **Bank Feed Linking**: Should we auto-suggest linking when bank transaction metadata matches entry amounts/dates?  
3. **Multi-Currency**: Hard-coded AUD for v1—confirm roadmap for NZ/US members.  
4. **Mobile Offline**: No offline mode yet; consider caching entries with IndexedDB later.  

**Next actions**: gather feedback, then scaffold migrations + controllers following this spec, and spin up the Vue workspace skeleton.
