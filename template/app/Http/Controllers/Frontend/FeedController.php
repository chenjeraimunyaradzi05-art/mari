<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Support\FeatureFlag;
use App\Support\Feed\FeedSettings;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class FeedController extends Controller
{
    public function __invoke(Request $request): View
    {
        FeatureFlag::ensure('feed.enabled');

        $filters = FeedSettings::filters();
        $available = FeedSettings::filtersByValue();
        $requestedFilter = $request->query('filter', 'latest');

        if (! isset($available[$requestedFilter]) || ! $available[$requestedFilter]['enabled']) {
            $requestedFilter = 'latest';
        }

        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min(50, $perPage));

        return view('frontend.feed.index', [
            'filters' => $filters,
            'activeFilter' => $requestedFilter,
            'feedEndpoint' => url('/api/v1/feed'),
            'perPage' => $perPage,
        ]);
    }
}

