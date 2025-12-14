<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use App\Models\OrganizationPage;
use App\Models\OrgMediaAsset;
use App\Models\OrgPost;
use App\Models\Course;
use App\Models\ApprenticeshipProgram;
use App\Models\Lead;
use App\Models\OrgFollower;

class OrganizationPageController extends Controller
{
    public function show(string $slug)
    {
        $page = OrganizationPage::withCount('followers')
            ->with(['media' => fn($q) => $q->latest()->limit(6)])
            ->where('slug', $slug)->firstOrFail();

        return response()->json($page);
    }

    public function videos(string $slug)
    {
        $page = OrganizationPage::where('slug', $slug)->firstOrFail();
        $videos = OrgMediaAsset::where('org_page_id', $page->id)->orderByDesc('id')->paginate(20);
        return response()->json($videos);
    }

    public function courses(string $slug)
    {
        $page = OrganizationPage::where('slug', $slug)->firstOrFail();
        $courses = Course::where('provider_org_page_id', $page->id)->with('intakes')->paginate(20);
        return response()->json($courses);
    }

    public function apprenticeships(string $slug)
    {
        $page = OrganizationPage::where('slug', $slug)->firstOrFail();
        $programs = ApprenticeshipProgram::where('org_page_id', $page->id)->paginate(20);
        return response()->json($programs);
    }

    public function lead(string $slug, Request $request)
    {
        $page = OrganizationPage::where('slug', $slug)->firstOrFail();
        $data = $request->validate([
            'type' => ['required', Rule::in(['course','apprenticeship','job','general'])],
            'payload' => ['required','array'],
            'source' => ['nullable','string','max:120'],
            'utm' => ['nullable','array'],
        ]);
        $lead = Lead::create([
            'org_page_id' => $page->id,
            'type' => $data['type'],
            'payload' => $data['payload'],
            'source' => $data['source'] ?? null,
            'status' => 'new',
            'assigned_to' => null,
            'utm' => $data['utm'] ?? null,
        ]);

        // TODO: trigger notifications / CRM webhook
        return response()->json(['ok' => true, 'id' => $lead->id], 201);
    }

    public function follow(string $slug)
    {
        $page = OrganizationPage::where('slug', $slug)->firstOrFail();
    $userId = Auth::id();
        OrgFollower::firstOrCreate(['org_page_id' => $page->id, 'user_id' => $userId]);

        // TODO: Add notification to page admins
        return response()->json(['ok' => true]);
    }

    public function invite(string $slug, Request $request)
    {
        $page = OrganizationPage::where('slug', $slug)->firstOrFail();
        $data = $request->validate([
            'emails' => ['required','array','min:1'],
            'emails.*' => ['email']
        ]);
        // TODO: send invite emails + in-app notifications with deep links
        return response()->json(['ok' => true, 'invited' => $data['emails']]);
    }
}
