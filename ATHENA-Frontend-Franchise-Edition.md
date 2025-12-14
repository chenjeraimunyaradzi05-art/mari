# ATHENA Frontend Refinement: Next.js/React with Laravel Backend
## Decoupled Architecture & Implementation Guide

**Version:** 4.2 Franchise-Enhanced Edition
**Date:** December 14, 2025
**Architecture:** Next.js 15 (Frontend) ↔️ Laravel 10/11 API (Backend)
**Status:** Ready for Parallel Development

---

## EXECUTIVE OVERVIEW: DECOUPLED ARCHITECTURE

### The Strategy

Instead of building everything in one Laravel monolith, we're adopting a **modern decoupled approach**:

```
┌─────────────────────────────────────────────────────┐
│                   NEXT.JS FRONTEND                  │
│  (User-facing logic, UI, routing, state management) │
│  ├── React Components (Members, Housing, Jobs)      │
│  ├── Next.js Pages & App Router                     │
│  ├── Tailwind CSS (Athena theme)                    │
│  ├── Real-time WebSockets (Pusher/Soketi)          │
│  ├── Client-side Analytics (Segment/Posthog)       │
│  └── Form Validation & Optimistic Updates           │
└─────────────────────────────────────────────────────┘
                          ↓ (REST/GraphQL APIs)
┌─────────────────────────────────────────────────────┐
│               LARAVEL 10/11 API BACKEND             │
│  (dzimba modules + ATHENA extensions)               │
│  ├── Authentication (Sanctum tokens)                │
│  ├── Database (PostgreSQL with pgvector)            │
│  ├── AI Services (Anthropic Claude, OpenAI)         │
│  ├── Media Processing (FFmpeg, S3 uploads)          │
│  ├── Payment Processing (Stripe webhooks)           │
│  ├── Safety & Moderation (Language linting)         │
│  ├── Real-time Broadcasting (Pusher channels)       │
│  ├── Business Logic (matching algo, feed ranking)   │
│  └── Franchise Management (Leads, Territories)      │ <--- NEW
└─────────────────────────────────────────────────────┘
```

---

## NEW MODULE: WOMEN'S FRANCHISE & BUSINESS-IN-A-BOX
**Focus:** Real Estate & Mobile Lending (inspired by ANZ Mobile Lending model)
**Goal:** Empower women to own micro-businesses powered by ATHENA leads.

### 1. Franchise Concept: "Athena Partners"
- **Model:** Women buy/apply for a "territory" or "niche" (e.g., "Athena Lending - Gold Coast").
- **Platform Value:** ATHENA provides the technology, branding, and **exclusive leads** from the main Housing platform.
- **Revenue:** Initial franchise fee + % of commission (e.g., on mortgage settlements).

### 2. Frontend Implementation (Next.js)
**Routes:**
- `/franchise` (Landing page: "Start your Business")
- `/franchise/onboarding` (Application wizard)
- `/franchise/dashboard` (Lead management, CRM, Learning)

**Key Components:**
- `LeadKanbanBoard`: Drag-and-drop leads (New -> Contacted -> Application -> Settled).
- `TerritoryMap`: Visual selection of available franchise zones.
- `CommissionTracker`: Real-time earnings dashboard.

---

## PART 2: FRONTEND DEVELOPMENT ROADMAP (UPDATED)

### **MILESTONE 0-5%: Branding & Foundation**
*(Unchanged - Setup Next.js, Tailwind, Auth)*

### **MILESTONE 5-10%: Role-Based Onboarding Wizard**
*(Unchanged - Collect User Intent)*

### **MILESTONE 10-15%: Franchise Portal (NEW)**

**Objective:** Build the interface for women to apply for and manage their Real Estate/Lending franchise.

**Implementation:**

```typescript
// app/(dashboard)/franchise/dashboard/page.tsx
'use client';

import { LeadKanban } from '@/components/franchise/LeadKanban';
import { CommissionChart } from '@/components/franchise/CommissionChart';
import { useFranchiseData } from '@/lib/hooks/useFranchise';

export default function FranchiseDashboard() {
  const { leads, metrics, isLoading } = useFranchiseData();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-midnight-900">
          Athena Lending: Gold Coast North
        </h1>
        <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-semibold">
          Active Partner
        </span>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          label="Active Leads" 
          value={metrics.activeLeads} 
          trend="+12%" 
        />
        <MetricCard 
          label="Pipeline Value" 
          value={`$${metrics.pipelineValue}M`} 
          color="rose" 
        />
        <MetricCard 
          label="Commissions (MTD)" 
          value={`$${metrics.commissionMTD}`} 
          color="teal" 
        />
        <MetricCard 
          label="Customer Rating" 
          value={metrics.rating} 
          icon="⭐" 
        />
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead Management (Kanban) */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm h-[600px]">
          <h2 className="text-xl font-bold mb-4">Lead Pipeline</h2>
          <LeadKanban leads={leads} />
        </div>

        {/* Right: Quick Actions & Alerts */}
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold mb-4">Urgent Actions</h2>
            <ul className="space-y-3">
              <ActionItem text="Call Sarah J. (Pre-approval expiring)" urgent />
              <ActionItem text="Submit docs for 12 Ocean Dr" />
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white p-6 rounded-xl shadow-md">
            <h3 className="font-bold text-lg mb-2">Franchise Support</h3>
            <p className="text-sm opacity-90 mb-4">Need help with a complex loan structure?</p>
            <button className="w-full bg-white text-rose-600 py-2 rounded-lg font-semibold">
              Chat with Head Office
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**API Integration (Laravel):**

```php
// app/Http/Controllers/Franchise/LeadController.php
class LeadController extends Controller {
  // Distribute leads from main Housing platform to Franchisees
  public function allocate(Request $request) {
    // Logic: Find franchise owner in user's postcode
    $franchise = Franchise::where('postcode', $request->postcode)->first();
    
    if ($franchise) {
        $lead = Lead::create([
            'user_id' => $request->user_id,
            'franchise_id' => $franchise->id,
            'type' => 'mortgage_enquiry',
            'status' => 'new'
        ]);
        
        // Notify Franchisee
        FranchiseNotification::dispatch($franchise, "New Lead: {$request->loan_amount}");
    }
  }
}
```

### **MILESTONE 30-35%: Housing Marketplace UI**
*(Updated to include "Connect with a Lender" CTA)*

- **Add Feature:** On property listings, add a "Get Finance" button.
- **Logic:** Instead of a generic bank link, this connects the user **directly** to the specific ATHENA Franchisee for that area (e.g., "Chat with Maria, your local Athena Lending Specialist").

---

## PART 5: MORTGAGE CALCULATOR AI (30-35% Milestone)
*(Updated with Lead Generation Hook)*

**Frontend Component Update:**

```typescript
// Inside MortgageCalculator.tsx results section
{calculation.is_affordable && (
  <div className="mt-6 bg-teal-50 border border-teal-200 p-4 rounded-lg flex items-center justify-between">
    <div>
      <div className="font-bold text-teal-900">Pre-qualify for this loan</div>
      <div className="text-sm text-teal-700">
        Connect with {localFranchisee.name}, your local Athena expert.
      </div>
    </div>
    <button 
      onClick={handleConnect}
      className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
    >
      Start Application
    </button>
  </div>
)}
```

---

## NEXT IMMEDIATE STEPS (Updated)

### For Frontend Team
1. ✅ Review updated roadmap including Franchise module.
2. ✅ Add "Agent/Franchise" role to Onboarding Wizard.
3. ✅ Create `/franchise` landing page components.

### For Backend Team
1. ✅ Design `Franchise` and `Territory` database tables.
2. ✅ Build logic for **Lead Allocation** (Geo-based routing).
3. ✅ Create "Commission Split" calculation engine (Franchise fee logic).

---

**Document Updated:** December 14, 2025 (Franchise Edition)
**Status:** Production-Ready Architecture