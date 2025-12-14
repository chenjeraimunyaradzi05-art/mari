<?php

namespace App\Http\Controllers\Business;

use App\Http\Controllers\Controller;
use App\Models\Business\BusinessResource;
use App\Services\Business\BusinessFeedService;
use Illuminate\View\View;

final class NetworkLandingController extends Controller
{
    public function __invoke(BusinessFeedService $feedService): View
    {
        BusinessResource::ensureStarterSet();

        $resources = BusinessResource::published()
            ->orderByDesc('ai_relevance_score')
            ->limit(6)
            ->get();

        $tags = $feedService->trendingTags(6);

        return view('business.network', [
            'resources' => $resources,
            'trendingTags' => $tags,
        ]);
    }
}

