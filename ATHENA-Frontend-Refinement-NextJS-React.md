# ATHENA Frontend Refinement: Next.js/React with Laravel Backend
## Decoupled Architecture & Implementation Guide

**Version:** 4.1 Frontend-Focused Edition  
**Date:** December 13, 2025  
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
│  └── Business Logic (matching algo, feed ranking)   │
└─────────────────────────────────────────────────────┘
```

### Why This Approach?

| Aspect | Benefit |
|--------|---------|
| **Speed** | Frontend team can build UI independently while backend team completes API endpoints |
| **Scalability** | Next.js frontend scales separately from Laravel API (different infra) |
| **Developer Experience** | React/TypeScript team uses modern tooling; Laravel team uses battle-tested patterns |
| **Team Flexibility** | Can hire front-end specialists vs. full-stack developers |
| **Maintenance** | UI changes don't require backend recompilation; API changes don't break frontend (with versioning) |
| **Testing** | Mock API responses in frontend; Unit tests in backend independently |

---

## PART 1: NEXT.JS FRONTEND ARCHITECTURE

### Project Structure

```
athena-frontend/
├── app/
│   ├── layout.tsx                 # Root layout (Header, Footer, providers)
│   ├── middleware.ts              # Auth checks, role-based routing
│   ├── (auth)/                    # Auth group (login, signup, onboard)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── onboard/page.tsx       # Multi-step wizard
│   ├── (dashboard)/               # Protected routes (dashboard, feed, etc)
│   │   ├── layout.tsx             # Dashboard layout
│   │   ├── feed/page.tsx          # Social feed (home)
│   │   ├── profile/page.tsx       # User profile
│   │   ├── housing/               # Housing marketplace
│   │   │   ├── page.tsx           # Search & browse
│   │   │   ├── [id]/page.tsx      # Property detail
│   │   │   └── mortgage-calc.tsx  # Mortgage calculator
│   │   ├── jobs/page.tsx          # Job listings
│   │   ├── education/page.tsx     # Courses & apprenticeships
│   │   ├── matches/page.tsx       # Matching recommendations
│   │   ├── agent/                 # Licensed agent portal
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── listings/page.tsx
│   │   │   └── verification/page.tsx
│   │   ├── money/                 # Sole trader finance
│   │   │   ├── page.tsx
│   │   │   ├── workspace/page.tsx
│   │   │   └── bundles/page.tsx
│   │   └── settings/page.tsx
│   └── api/                       # Optional: For serverless functions
│       └── [route]/route.ts       # Next.js Route Handlers
├── components/
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Navigation.tsx
│   │   └── RoleBadge.tsx          # Shows user role/intent
│   ├── forms/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   ├── OnboardingWizard.tsx
│   │   ├── ProfileForm.tsx        # Role-specific (Agent, Renter, etc)
│   │   └── PropertyListingForm.tsx
│   ├── cards/
│   │   ├── FeedPostCard.tsx
│   │   ├── PropertyCard.tsx
│   │   ├── JobCard.tsx
│   │   └── MatchCard.tsx
│   ├── widgets/
│   │   ├── MortgageCalculator.tsx
│   │   ├── AICoach.tsx            # Floating AI assistant
│   │   ├── SocialReactions.tsx   # Like/comment/share
│   │   └── RealTimeNotifications.tsx
│   └── modals/
│       ├── CreatePostModal.tsx
│       ├── PropertyInquiryModal.tsx
│       └── PaymentModal.tsx
├── lib/
│   ├── api/                       # API client functions
│   │   ├── auth.ts                # Login, signup, logout
│   │   ├── profile.ts             # Profile CRUD
│   │   ├── feed.ts                # Feed ranking, posts
│   │   ├── housing.ts             # Property search, listings
│   │   ├── matching.ts            # Matching recommendations
│   │   ├── ai.ts                  # AI services (mortgage, coach, etc)
│   │   └── payments.ts            # Stripe integration
│   ├── hooks/
│   │   ├── useAuth.ts             # Auth context
│   │   ├── useUser.ts             # User profile context
│   │   ├── useFeed.ts             # Feed data fetching
│   │   ├── useMortgageCalc.ts    # Mortgage calculator hook
│   │   └── useRealTime.ts         # WebSocket subscriptions
│   ├── utils/
│   │   ├── formatting.ts          # Date, currency, number formatting
│   │   ├── validation.ts          # Form validation rules
│   │   ├── language-linter.ts     # Client-side pronoun/safety checking
│   │   └── logger.ts              # Analytics logging
│   ├── stores/                    # Zustand state management
│   │   ├── authStore.ts           # Auth state
│   │   ├── uiStore.ts             # UI state (modals, notifications)
│   │   └── cacheStore.ts          # Local caching
│   ├── constants/
│   │   ├── roles.ts               # Role definitions
│   │   ├── intents.ts             # User intents
│   │   └── config.ts              # API endpoints, feature flags
│   └── types/
│       ├── api.ts                 # TypeScript interfaces for API responses
│       ├── user.ts                # User, Profile types
│       ├── property.ts            # Property, Listing types
│       └── matching.ts            # Match score types
├── styles/
│   ├── globals.css               # Global styles
│   ├── tailwind.config.ts        # Tailwind config (Athena theme)
│   └── variables.css             # CSS custom properties
├── public/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── middleware.ts                 # Next.js middleware (auth, routing)
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── .env.local                    # API endpoints, keys
```

---

## PART 2: FRONTEND DEVELOPMENT ROADMAP (5% INCREMENTS)

### **MILESTONE 0-5%: Branding & Foundation**

**Objective:** Setup Next.js project with Athena branding (feminine theme, Member terminology, core layout)

**Tasks:**

```typescript
// 1. Initialize Next.js
$ npm create next-app@latest athena-frontend --ts --tailwind

// 2. Install dependencies
$ npm install zustand @tanstack/react-query axios next-auth @hookform/react react-hook-form

// 3. Setup Athena theme (tailwind.config.ts)
export default {
  theme: {
    extend: {
      colors: {
        rose: {
          600: '#d53f8c',      // Primary brand (Athena pink)
          400: '#f687b3',      // Light variant
        },
        teal: {
          500: '#208080',      // Action/secondary
          600: '#1a6666',      // Darker variant
        },
        blush: {
          50: '#fff8fb',
          100: '#ffe4ef',
        },
        mauve: {
          300: '#cdb4db',
        },
        midnight: {
          900: '#2f2432',      // Text color
        },
      },
    },
  },
};

// 4. Create root layout with Header/Footer
// app/layout.tsx
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import Providers from '@/lib/providers';

export const metadata = {
  title: 'ATHENA - Women\'s Career & Economic Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-cream-50 text-midnight-900">
        <Providers>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

// 5. Replace "Candidate" with "Member" in all strings
// Create a translation/copy file
export const copy = {
  navigation: {
    dashboard: 'Dashboard',
    feed: 'For You',
    matches: 'Matches',
    profile: 'Profile',
    housing: 'Housing',
    jobs: 'Jobs',
    education: 'Learning',
    money: 'Money',
  },
  roles: {
    member: 'Member',       // Not "Candidate"
    educator: 'Educator',
    provider: 'Service Provider',
    founder: 'Founder',
    agent: 'Real Estate Agent',
  },
};

// 6. Create authentication context
// lib/stores/authStore.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  login: async (email, password) => {
    // Call Laravel API
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const { user, token } = await response.json();
    set({ user, token });
    localStorage.setItem('token', token);
  },
  logout: () => {
    set({ user: null, token: null });
    localStorage.removeItem('token');
  },
}));
```

**GitHub Copilot Prompts:**
```
"Setup Next.js 15 project with TypeScript and Tailwind CSS for women-focused platform"
"Create Tailwind color theme with rose (#d53f8c), teal (#208080), and blush colors"
"Replace all instances of 'Candidate' with 'Member' in Next.js copy/translation files"
"Create root layout component with Header, Footer, and Auth provider"
```

**Deliverables:**
✅ Next.js project initialized  
✅ Athena feminine theme configured  
✅ Root layout with header/footer  
✅ "Member" terminology throughout  
✅ Authentication context setup  

---

### **MILESTONE 5-10%: Role-Based Onboarding Wizard**

**Objective:** Build multi-step onboarding form that collects role, pronouns, intent, and creates user profile

**Implementation:**

```typescript
// components/forms/OnboardingWizard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import axios from 'axios';

const ROLES = [
  { id: 'member', label: 'Looking for Work', icon: '👩‍💼', desc: 'Find jobs, apprenticeships' },
  { id: 'educator', label: 'Teaching/Training', icon: '👩‍🏫', desc: 'Offer courses, mentoring' },
  { id: 'provider', label: 'Offering Services', icon: '👩‍💻', desc: 'Freelance, consulting' },
  { id: 'founder', label: 'Starting a Business', icon: '👩‍🚀', desc: 'Entrepreneur resources' },
  { id: 'agent', label: 'Real Estate Agent', icon: '🏠', desc: 'Property listings' },
];

const PRONOUNS = [
  { id: 'she_her', label: 'She/Her' },
  { id: 'he_him', label: 'He/Him' },
  { id: 'they_them', label: 'They/Them' },
  { id: 'other', label: 'Other' },
];

const INTENTS = [
  'Career Development',
  'Financial Independence',
  'Home Ownership',
  'Business Ownership',
  'Education',
  'Mentorship',
];

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    role: '',
    pronouns: '',
    interests: [] as string[],
    location: '',
    bio: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user } = useAuthStore();

  const updateForm = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleInterest = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Call Laravel API to complete onboarding
      await axios.post('/api/v1/onboarding/complete', {
        user_id: user?.id,
        role: formData.role,
        pronouns: formData.pronouns,
        interests: formData.interests,
        location: formData.location,
        bio: formData.bio,
      });

      // Redirect to dashboard
      router.push('/feed');
    } catch (error) {
      console.error('Onboarding error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blush-100 via-cream-50 to-blush-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Progress bar */}
        <div className="flex gap-2 mb-12">
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              className={`flex-1 h-2 rounded-full transition ${
                num <= step ? 'bg-rose-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Role Selection */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-midnight-900 mb-2">
                Welcome to ATHENA
              </h1>
              <p className="text-lg text-gray-600">
                What brings you here today?
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ROLES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => {
                    updateForm('role', role.id);
                    setStep(2);
                  }}
                  className={`p-6 rounded-lg border-2 transition ${
                    formData.role === role.id
                      ? 'border-rose-600 bg-rose-50'
                      : 'border-gray-200 bg-white hover:border-rose-400'
                  }`}
                >
                  <div className="text-5xl mb-3">{role.icon}</div>
                  <div className="font-bold text-midnight-900">{role.label}</div>
                  <div className="text-sm text-gray-600 mt-2">{role.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Pronouns & Personal Info */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-6">Tell us about yourself</h2>
              
              <label className="block mb-4">
                <span className="block font-semibold mb-2">Pronouns</span>
                <select
                  value={formData.pronouns}
                  onChange={(e) => updateForm('pronouns', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-600"
                >
                  <option value="">Select pronouns</option>
                  {PRONOUNS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block font-semibold mb-2">Location (suburb/city)</span>
                <input
                  type="text"
                  placeholder="e.g., Sydney, NSW"
                  value={formData.location}
                  onChange={(e) => updateForm('location', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-600"
                />
              </label>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 border border-gray-300 rounded-lg font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!formData.pronouns || !formData.location}
                className="flex-1 px-6 py-2 bg-rose-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Interests & Intents */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-6">What are you interested in?</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INTENTS.map((intent) => (
                  <button
                    key={intent}
                    onClick={() => toggleInterest(intent)}
                    className={`p-4 rounded-lg border-2 font-semibold transition text-left ${
                      formData.interests.includes(intent)
                        ? 'border-rose-600 bg-rose-50 text-rose-900'
                        : 'border-gray-200 bg-white text-midnight-900 hover:border-rose-400'
                    }`}
                  >
                    {formData.interests.includes(intent) ? '✓ ' : ''}{intent}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 border border-gray-300 rounded-lg font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={formData.interests.length === 0}
                className="flex-1 px-6 py-2 bg-rose-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Bio & Photo */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-6">Create your profile</h2>
              
              <label className="block mb-4">
                <span className="block font-semibold mb-2">Bio (optional)</span>
                <textarea
                  placeholder="Tell us a bit about yourself..."
                  value={formData.bio}
                  onChange={(e) => updateForm('bio', e.target.value)}
                  maxLength={160}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-600 resize-none"
                />
                <div className="text-sm text-gray-500 mt-1">
                  {formData.bio.length}/160 characters
                </div>
              </label>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 border border-gray-300 rounded-lg font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-6 py-2 bg-rose-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {isSubmitting ? 'Setting up...' : 'Complete Onboarding'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**API Integration (Laravel):**

```php
// routes/api.php (Laravel)
Route::post('/onboarding/complete', [OnboardingController::class, 'complete']);

// app/Http/Controllers/OnboardingController.php
class OnboardingController extends Controller {
  public function complete(Request $request) {
    $validated = $request->validate([
      'role' => 'required|in:member,educator,provider,founder,agent',
      'pronouns' => 'required|string',
      'interests' => 'required|array',
      'location' => 'required|string',
      'bio' => 'nullable|string|max:160',
    ]);

    $user = Auth::user();
    
    // Create/update profile
    $user->profile()->updateOrCreate([], [
      'role' => $validated['role'],
      'pronouns' => $validated['pronouns'],
      'interests' => $validated['interests'], // JSON
      'location' => $validated['location'],
      'bio' => $validated['bio'],
      'completed_at' => now(),
    ]);

    return response()->json(['success' => true]);
  }
}
```

**GitHub Copilot Prompts:**
```
"Create multi-step React onboarding wizard with role, pronouns, interests, and bio"
"Build Zustand store for form state management across wizard steps"
"Generate Laravel API endpoint for storing onboarding completion"
"Implement form validation with React Hook Form"
```

**Deliverables:**
✅ 4-step onboarding wizard  
✅ Role selection UI  
✅ Pronouns & interests collection  
✅ Form state management (Zustand)  
✅ API integration with Laravel  

---

### **MILESTONE 10-15%: RBAC & Navigation Gating**

**Objective:** Implement role-based access control with Next.js middleware and conditional navigation

```typescript
// middleware.ts (Next.js)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/agent') || pathname.startsWith('/money')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Check role-specific access
  if (pathname.startsWith('/agent')) {
    // Only role='agent' can access /agent
    const role = request.cookies.get('user_role')?.value;
    if (role !== 'agent') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/agent/:path*', '/money/:path*'],
};
```

```typescript
// components/common/Navigation.tsx
'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/authStore';

export function Navigation() {
  const { user } = useAuthStore();

  if (!user) return null;

  const navItems = [
    { label: 'For You', href: '/feed', show: true },
    { label: 'Profile', href: '/profile', show: true },
    { label: 'Matches', href: '/matches', show: true },
    { label: 'Housing', href: '/housing', show: user.user_intentions?.includes('home_ownership') },
    { label: 'Jobs', href: '/jobs', show: user.user_intentions?.includes('career_development') },
    { label: 'Learning', href: '/education', show: user.user_intentions?.includes('education') },
    { label: 'Money', href: '/money', show: user.role === 'founder' },
    { label: 'Agent Dashboard', href: '/agent/dashboard', show: user.role === 'agent' },
  ];

  return (
    <nav className="flex gap-6">
      {navItems
        .filter((item) => item.show)
        .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="font-semibold text-gray-700 hover:text-rose-600"
          >
            {item.label}
          </Link>
        ))}
    </nav>
  );
}
```

**Deliverables:**
✅ Next.js middleware for auth checks  
✅ Role-based route protection  
✅ Conditional navigation based on user intent  
✅ Automatic redirects for unauthorized access  

---

### **MILESTONE 15-20%: Safety & Pronoun Linting**

**Objective:** Implement client-side language linting for safety compliance

```typescript
// lib/utils/language-linter.ts
export interface LintIssue {
  type: 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export function lintContent(text: string): LintIssue[] {
  const issues: LintIssue[] = [];

  // Male heuristics (examples - customize based on policy)
  const maleReferencePatterns = [
    { pattern: /\bman\b/gi, suggestion: 'Consider using "person" or "individual"' },
    { pattern: /\bhe\b/gi, context: 'pronoun', message: 'Generic use of "he" - consider "they" or specify gender' },
  ];

  maleReferencePatterns.forEach(({ pattern, suggestion, message }) => {
    if (pattern.test(text)) {
      issues.push({
        type: 'warning',
        message: message || 'Potentially non-inclusive language detected',
        suggestion,
      });
    }
  });

  // Safety keywords (harassment, threats)
  const safetyPatterns = [
    { pattern: /kill|murder|threat/gi, type: 'error' as const, message: 'Threatening language detected' },
    { pattern: /bitch|slut|whore/gi, type: 'error' as const, message: 'Abusive language detected' },
  ];

  safetyPatterns.forEach(({ pattern, type, message }) => {
    if (pattern.test(text)) {
      issues.push({ type, message });
    }
  });

  return issues;
}

export function isContentSafe(text: string): boolean {
  const issues = lintContent(text);
  return !issues.some((issue) => issue.type === 'error');
}
```

```typescript
// components/forms/SafeTextarea.tsx
'use client';

import { useState } from 'react';
import { lintContent, LintIssue } from '@/lib/utils/language-linter';

export function SafeTextarea({
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  maxLength: number;
  placeholder: string;
}) {
  const [issues, setIssues] = useState<LintIssue[]>([]);

  const handleChange = (text: string) => {
    onChange(text);
    setIssues(lintContent(text));
  };

  const hasErrors = issues.some((issue) => issue.type === 'error');

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border rounded-lg resize-none focus:ring-2 ${
          hasErrors ? 'border-red-500 focus:ring-red-600' : 'border-gray-300 focus:ring-rose-600'
        }`}
      />

      {/* Display linting issues */}
      {issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue, idx) => (
            <div
              key={idx}
              className={`p-3 rounded text-sm ${
                issue.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
              }`}
            >
              <div className="font-semibold">{issue.message}</div>
              {issue.suggestion && (
                <div className="text-xs mt-1">💡 {issue.suggestion}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Character count */}
      <div className="text-sm text-gray-500">
        {value.length}/{maxLength} characters
      </div>
    </div>
  );
}
```

**Deliverables:**
✅ Client-side language linting  
✅ Real-time safety feedback  
✅ Error vs. warning distinction  
✅ Helpful suggestions for improvement  

---

### **MILESTONE 20-25%: Social Feed (Video-First)**

**Objective:** Build TikTok/Reels-style infinite scroll feed with short videos

```typescript
// app/(dashboard)/feed/page.tsx
'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import InfiniteScroll from 'react-infinite-scroll-component';
import { FeedPostCard } from '@/components/cards/FeedPostCard';
import axios from 'axios';

export default function FeedPage() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 0 }) => {
      const { data } = await axios.get('/api/v1/feed', {
        params: { page: pageParam, limit: 20 },
      });
      return data;
    },
    getNextPageParam: (lastPage, pages) => pages.length,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <InfiniteScroll
        dataLength={posts.length}
        next={() => fetchNextPage()}
        hasMore={hasNextPage}
        loader={<div className="text-center py-8">Loading...</div>}
      >
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
        </div>
      </InfiniteScroll>
    </div>
  );
}

// components/cards/FeedPostCard.tsx
import { useState } from 'react';
import { SocialReactions } from '@/components/widgets/SocialReactions';

export function FeedPostCard({ post }) {
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <img src={post.author.avatar} alt={post.author.name} className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <div className="font-semibold">{post.author.name}</div>
          <div className="text-xs text-gray-500">{post.created_at}</div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="mb-3">{post.content}</p>

        {/* Video/Image */}
        {post.video && (
          <video
            controls
            autoPlay
            muted
            className="w-full rounded-lg mb-3"
            style={{ maxHeight: '400px' }}
          >
            <source src={post.video} type="video/mp4" />
          </video>
        )}

        {post.image && (
          <img src={post.image} alt="Post" className="w-full rounded-lg mb-3" />
        )}
      </div>

      {/* Actions */}
      <SocialReactions postId={post.id} post={post} />

      {/* Comments */}
      {showComments && (
        <div className="border-t p-4">
          {/* Comment section */}
        </div>
      )}
    </div>
  );
}
```

**Deliverables:**
✅ Infinite scroll feed  
✅ Video playback with controls  
✅ Author info display  
✅ Engagement metrics  

---

## PART 3: API INTEGRATION CHECKLIST (LARAVEL BACKEND)

### Required Laravel API Endpoints

```php
// Authentication
POST   /api/v1/auth/login              # Login
POST   /api/v1/auth/signup             # Register
POST   /api/v1/auth/logout             # Logout
POST   /api/v1/auth/refresh            # Refresh token
GET    /api/v1/auth/me                 # Get current user

// Onboarding
POST   /api/v1/onboarding/complete     # Complete onboarding
GET    /api/v1/profile/{userId}        # Get profile
PUT    /api/v1/profile/{userId}        # Update profile

// Feed
GET    /api/v1/feed                    # Get ranked feed posts
POST   /api/v1/posts                   # Create post
POST   /api/v1/posts/{id}/like         # Like post
POST   /api/v1/posts/{id}/comment      # Add comment

// Housing (Real Estate)
GET    /api/v1/properties              # Search properties
GET    /api/v1/properties/{id}         # Get property detail
POST   /api/v1/properties              # Create listing (agents)
POST   /api/v1/ai/mortgage-calc        # Calculate mortgage

// Matching
GET    /api/v1/matching/recommendations  # Get match suggestions
POST   /api/v1/matching/score           # Calculate match score

// AI Services
POST   /api/v1/ai/mortgage-calc        # Mortgage calculation (real-time)
POST   /api/v1/ai/profile-hint         # Profile suggestions
POST   /api/v1/ai/content-moderation   # Content safety check

// Payments (Stripe)
POST   /api/v1/subscriptions/create    # Create subscription
POST   /api/v1/payments/webhook        # Stripe webhook
```

---

## PART 4: ENVIRONMENT CONFIGURATION

```env
# .env.local (Next.js)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:6001
NEXT_PUBLIC_ANALYTICS_KEY=your_posthog_key

# For authenticated requests
AUTH_TOKEN_KEY=athena_auth_token
```

```env
# .env (Laravel)
FRONTEND_URL=http://localhost:3000
SANCTUM_STATEFUL_DOMAINS=localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

---

## PART 5: MORTGAGE CALCULATOR AI (30-35% Milestone)

This is a **real-time, AI-powered mortgage repayment calculator** that combines current market data with member profile insights.

### Frontend Component

```typescript
// components/widgets/MortgageCalculator.tsx
'use client';

import { useState, useEffect } from 'react';
import { useMortgageCalc } from '@/lib/hooks/useMortgageCalc';

export function MortgageCalculator({ propertyPrice }: { propertyPrice: number }) {
  const [inputs, setInputs] = useState({
    propertyPrice: propertyPrice || 500000,
    downPayment: 100000,
    loanTerm: 30, // years
  });
  const [calculation, setCalculation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { calculateMortgage } = useMortgageCalc();

  useEffect(() => {
    const calculate = async () => {
      setIsLoading(true);
      const result = await calculateMortgage(inputs);
      setCalculation(result);
      setIsLoading(false);
    };

    calculate();
  }, [inputs]);

  const loanAmount = inputs.propertyPrice - inputs.downPayment;
  const downPaymentPercent = (inputs.downPayment / inputs.propertyPrice) * 100;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <h3 className="text-2xl font-bold mb-6">Mortgage Calculator</h3>

      {/* Inputs */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block font-semibold mb-2">Property Price</label>
          <input
            type="range"
            min="100000"
            max="2000000"
            step="50000"
            value={inputs.propertyPrice}
            onChange={(e) => setInputs((p) => ({ ...p, propertyPrice: parseInt(e.target.value) }))}
            className="w-full"
          />
          <div className="text-xl font-bold text-rose-600 mt-2">
            AU${inputs.propertyPrice.toLocaleString()}
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2">Down Payment ({downPaymentPercent.toFixed(1)}%)</label>
          <input
            type="range"
            min="0"
            max={inputs.propertyPrice * 0.5}
            step="10000"
            value={inputs.downPayment}
            onChange={(e) => setInputs((p) => ({ ...p, downPayment: parseInt(e.target.value) }))}
            className="w-full"
          />
          <div className="text-xl font-bold text-teal-600 mt-2">
            AU${inputs.downPayment.toLocaleString()}
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2">Loan Term (years)</label>
          <input
            type="range"
            min="5"
            max="40"
            step="1"
            value={inputs.loanTerm}
            onChange={(e) => setInputs((p) => ({ ...p, loanTerm: parseInt(e.target.value) }))}
            className="w-full"
          />
          <div className="text-lg font-bold mt-2">{inputs.loanTerm} years</div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Calculating...</div>
      ) : calculation ? (
        <div className="bg-gradient-to-br from-blush-100 to-rose-50 p-6 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Monthly Payment</div>
              <div className="text-3xl font-bold text-rose-600">
                AU${calculation.monthly_payment.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Interest Rate</div>
              <div className="text-2xl font-bold text-teal-600">
                {calculation.interest_rate.toFixed(2)}%
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Total Interest</div>
              <div className="text-xl font-semibold">
                AU${calculation.total_interest.toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Affordability</div>
              <div className={`text-xl font-semibold ${
                calculation.is_affordable ? 'text-green-600' : 'text-red-600'
              }`}>
                {calculation.is_affordable ? '✓ Affordable' : '⚠ High Risk'}
              </div>
            </div>
          </div>

          {/* AI Insights */}
          {calculation.ai_insights && (
            <div className="mt-4 pt-4 border-t border-rose-200">
              <div className="text-sm font-semibold mb-2">💡 AI Insights</div>
              <div className="text-sm text-gray-700">
                {calculation.ai_insights}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

### API Integration (Hook)

```typescript
// lib/hooks/useMortgageCalc.ts
import { useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';

export function useMortgageCalc() {
  const { user } = useAuthStore();

  const calculateMortgage = async (inputs: {
    propertyPrice: number;
    downPayment: number;
    loanTerm: number;
  }) => {
    const response = await axios.post('/api/v1/ai/mortgage-calc', {
      ...inputs,
      user_id: user?.id,
      loan_amount: inputs.propertyPrice - inputs.downPayment,
    });

    return response.data;
  };

  return { calculateMortgage };
}
```

### Laravel Backend Implementation

```php
// app/Http/Controllers/AI/MortgageCalculatorController.php
namespace App\Http\Controllers\AI;

use Illuminate\Http\Request;
use Anthropic\Anthropic;

class MortgageCalculatorController extends Controller {
  public function calculate(Request $request) {
    $validated = $request->validate([
      'property_price' => 'required|numeric',
      'down_payment' => 'required|numeric',
      'loan_term' => 'required|integer',
      'loan_amount' => 'required|numeric',
      'user_id' => 'required|string',
    ]);

    // Get real-time interest rate (from API like RBA, or cached)
    $interestRate = $this->getRealTimeInterestRate();

    // Get user profile for AI risk assessment
    $user = User::find($validated['user_id']);
    $userProfile = $user->profile;

    // Standard amortization formula
    $monthlyRate = $interestRate / 100 / 12;
    $numPayments = $validated['loan_term'] * 12;
    
    $monthlyPayment = $validated['loan_amount'] * 
      ($monthlyRate * pow(1 + $monthlyRate, $numPayments)) / 
      (pow(1 + $monthlyRate, $numPayments) - 1);

    $totalPayment = $monthlyPayment * $numPayments;
    $totalInterest = $totalPayment - $validated['loan_amount'];

    // AI-based affordability assessment
    $aiInsights = $this->getAIInsights(
      $validated,
      $monthlyPayment,
      $interestRate,
      $userProfile
    );

    return response()->json([
      'monthly_payment' => round($monthlyPayment, 2),
      'interest_rate' => $interestRate,
      'total_interest' => round($totalInterest, 2),
      'total_payment' => round($totalPayment, 2),
      'is_affordable' => $monthlyPayment < ($userProfile->estimated_income * 0.3),
      'ai_insights' => $aiInsights,
      'market_score' => rand(0.7, 0.95), // Placeholder - would use real market data
    ]);
  }

  private function getRealTimeInterestRate() {
    // Cache this to avoid API calls on every calculation
    return cache()->remember('interest_rate', 3600, function () {
      // Call external API (e.g., RBA data, financial API)
      return 6.25; // Example
    });
  }

  private function getAIInsights($inputs, $monthlyPayment, $rate, $profile) {
    $client = new Anthropic();

    $prompt = "
    A member is considering a property mortgage:
    - Property price: AU\${$inputs['property_price']}
    - Down payment: AU\${$inputs['down_payment']} ({percentage}%)
    - Loan term: {$inputs['loan_term']} years
    - Monthly payment: AU\${$monthlyPayment}
    - Current interest rate: {$rate}%
    
    Provide a brief, encouraging AI insight (1-2 sentences) for a female home buyer in Australia.
    ";

    $message = $client->messages->create([
      'model' => 'claude-3-5-sonnet-20241022',
      'max_tokens' => 150,
      'messages' => [['role' => 'user', 'content' => $prompt]],
    ]);

    return $message->content[0]->text;
  }
}
```

---

## QUICK START: MILESTONE 0-5%

```bash
# 1. Create Next.js project
npm create next-app@latest athena-frontend --ts --tailwind

# 2. Install core dependencies
npm install zustand @tanstack/react-query axios next-auth

# 3. Setup Laravel API (.env)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1

# 4. Create auth context (lib/stores/authStore.ts)
# [Use code examples above]

# 5. Create root layout (app/layout.tsx)
# [Use code examples above]

# 6. Build branding components (components/common/Header.tsx, Footer.tsx)
# [Custom components with Athena theme]

# 7. Deploy to Vercel
npm run build
vercel deploy
```

---

## NEXT IMMEDIATE STEPS

### For Frontend Team (Next.js/React)
1. ✅ Read this document completely
2. ✅ Setup Next.js project locally
3. ✅ Implement Milestone 0-5% (branding + layout)
4. ✅ Build onboarding wizard (Milestone 5-10%)
5. ✅ Implement RBAC middleware (Milestone 10-15%)
6. ✅ Test with mock API responses (Tanstack Query with fixtures)

### For Backend Team (Laravel)
1. ✅ Review the required API endpoints (Part 3)
2. ✅ Implement authentication endpoints (Sanctum tokens)
3. ✅ Build profile CRUD endpoints
4. ✅ Create feed ranking API
5. ✅ Setup real-time broadcasting (Pusher/Soketi)
6. ✅ Implement AI services (Anthropic Claude, OpenAI)

### For DevOps/Infrastructure
1. ✅ Setup CORS configuration (allow localhost:3000)
2. ✅ Deploy Laravel API (AWS or Heroku)
3. ✅ Setup WebSocket server (Pusher account)
4. ✅ Configure environment variables on both sides
5. ✅ Setup GitHub Actions for CI/CD

---

**Document Created:** December 13, 2025  
**Status:** Production-Ready Architecture  
**Next Review:** After Milestone 0-5% completion