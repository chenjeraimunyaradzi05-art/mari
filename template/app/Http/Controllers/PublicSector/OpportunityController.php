<?php

namespace App\Http\Controllers\PublicSector;

use App\Http\Controllers\Controller;
use App\Models\PublicSectorOpportunity;
use App\Models\SocialPost;
use App\Services\PublicSector\PublicSectorInsightService;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class OpportunityController extends Controller
{
    public function __construct(private readonly PublicSectorInsightService $insightService)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function index(Request $request): View
    {
        $query = PublicSectorOpportunity::with('agency');

        $tag = trim((string) $request->input('tag', ''));
        $work = trim((string) $request->input('work_arrangement', ''));

        if ($tag !== '') {
            $query->whereJsonContains('tags', $tag);
        }

        if ($work !== '') {
            $query->where('work_arrangement', $work);
        }

        if ($request->boolean('featured')) {
            $query->featured();
        }

        $opportunities = $query->open()
            ->orderByDesc('is_featured')
            ->orderBy('closes_at')
            ->paginate(12)
            ->withQueryString();

        $tagOptions = PublicSectorOpportunity::query()
            ->pluck('tags')
            ->flatten()
            ->filter()
            ->unique()
            ->sort()
            ->values();

        $workOptions = PublicSectorOpportunity::query()
            ->select('work_arrangement')
            ->whereNotNull('work_arrangement')
            ->distinct()
            ->pluck('work_arrangement');

        return view('public-sector.opportunities.index', [
            'opportunities' => $opportunities,
            'tagOptions' => $tagOptions,
            'workOptions' => $workOptions,
            'filters' => [
                'tag' => $tag,
                'work_arrangement' => $work,
                'featured' => $request->boolean('featured'),
            ],
        ]);
    }

    public function show(PublicSectorOpportunity $opportunity): View
    {
        $opportunity->load(['agency', 'program']);
        $aiSummary = $this->insightService->summarizeOpportunity($opportunity);

        $relatedPosts = SocialPost::public()
            ->active()
            ->where(function ($query) use ($opportunity): void {
                collect($opportunity->tags ?? [])->each(function (string $tag) use ($query): void {
                    $query->orWhereJsonContains('tags', $tag);
                });
                $query->orWhere('caption', 'like', '%'.$opportunity->agency?->name.'%');
            })
            ->with('profile')
            ->latest('published_at')
            ->take(3)
            ->get();

        return view('public-sector.opportunities.show', [
            'opportunity' => $opportunity,
            'aiSummary' => $aiSummary,
            'relatedPosts' => $relatedPosts,
        ]);
    }
}

