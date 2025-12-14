<?php

namespace App\Http\Controllers\PublicSector;

use App\Http\Controllers\Controller;
use App\Models\PublicSectorAgency;
use App\Models\PublicSectorOpportunity;
use App\Models\PublicSectorProgram;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Illuminate\Support\Str;

final class AgencyDashboardController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth', 'verified']);
    }

    public function index(Request $request): View
    {
        $agency = PublicSectorAgency::where('owner_id', $request->user()->id)->first();

        if (!$agency) {
            // If user doesn't have an agency, maybe redirect to a "Register Agency" page or show empty state
            return view('public-sector.agency.onboarding');
        }

        $opportunities = $agency->opportunities()->latest()->take(5)->get();
        $programs = $agency->programs()->latest()->take(5)->get();

        // Mock analytics for now
        $analytics = [
            'views' => 1250,
            'applications' => 45,
            'followers' => 120,
        ];

        return view('public-sector.agency.dashboard', [
            'agency' => $agency,
            'opportunities' => $opportunities,
            'programs' => $programs,
            'analytics' => $analytics,
        ]);
    }

    public function create(): View
    {
        return view('public-sector.agency.onboarding');
    }

    public function store(Request $request): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string', // federal, state, local
            'summary' => 'nullable|string',
            'contact_email' => 'nullable|email',
            'hq_city' => 'nullable|string',
        ]);

        $agency = PublicSectorAgency::create([
            'owner_id' => $request->user()->id,
            'name' => $validated['name'],
            'category' => $validated['category'],
            'summary' => $validated['summary'],
            'contact_email' => $validated['contact_email'],
            'hq_city' => $validated['hq_city'],
            'status' => 'active',
            'impact_score' => 0,
        ]);

        // Ensure social profile exists
        $agency->ensureSocialProfile();

        return redirect()->route('public-sector.agency.dashboard')->with('success', 'Agency profile created successfully.');
    }

    public function createOpportunity(Request $request): View
    {
        $agency = PublicSectorAgency::where('owner_id', $request->user()->id)->firstOrFail();
        return view('public-sector.agency.opportunities.create', ['agency' => $agency]);
    }

    public function storeOpportunity(Request $request): \Illuminate\Http\RedirectResponse
    {
        $agency = PublicSectorAgency::where('owner_id', $request->user()->id)->firstOrFail();

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'summary' => 'required|string',
            'description' => 'required|string',
            'location' => 'required|string',
            'work_arrangement' => 'required|string|in:remote,hybrid,onsite',
            'role_level' => 'required|string',
            'closes_at' => 'nullable|date',
            'tags' => 'nullable|string', // Comma separated
        ]);

        $tags = $validated['tags'] ? array_map('trim', explode(',', $validated['tags'])) : [];

        $agency->opportunities()->create([
            'title' => $validated['title'],
            'slug' => Str::slug($validated['title']) . '-' . Str::random(6),
            'summary' => $validated['summary'],
            'description' => $validated['description'],
            'location' => $validated['location'],
            'work_arrangement' => $validated['work_arrangement'],
            'role_level' => $validated['role_level'],
            'closes_at' => $validated['closes_at'],
            'tags' => $tags,
            'status' => 'open',
            'is_featured' => false,
        ]);

        return redirect()->route('public-sector.agency.dashboard')->with('success', 'Opportunity created successfully.');
    }

    public function createProgram(Request $request): View
    {
        $agency = PublicSectorAgency::where('owner_id', $request->user()->id)->firstOrFail();
        return view('public-sector.agency.programs.create', ['agency' => $agency]);
    }

    public function storeProgram(Request $request): \Illuminate\Http\RedirectResponse
    {
        $agency = PublicSectorAgency::where('owner_id', $request->user()->id)->firstOrFail();

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'program_type' => 'required|string', // accelerator, incubator, grant, etc.
            'summary' => 'required|string',
            'eligibility' => 'nullable|string',
            'delivery_mode' => 'required|string|in:online,hybrid,onsite',
            'next_intake_date' => 'nullable|date',
            'application_url' => 'nullable|url',
            'tags' => 'nullable|string',
        ]);

        $tags = $validated['tags'] ? array_map('trim', explode(',', $validated['tags'])) : [];

        $agency->programs()->create([
            'title' => $validated['title'],
            'slug' => Str::slug($validated['title']) . '-' . Str::random(6),
            'program_type' => $validated['program_type'],
            'summary' => $validated['summary'],
            'eligibility' => $validated['eligibility'],
            'delivery_mode' => $validated['delivery_mode'],
            'next_intake_date' => $validated['next_intake_date'],
            'application_url' => $validated['application_url'],
            'tags' => $tags,
            'application_status' => 'open',
        ]);

        return redirect()->route('public-sector.agency.dashboard')->with('success', 'Program created successfully.');
    }
}

