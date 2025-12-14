<?php

namespace App\View\Composers\Frontend;

use App\Support\Analytics\Repositories\CareerIntelligenceRepository;
use App\Support\Analytics\Repositories\CreatorPayoutRepository;
use App\Support\Analytics\Repositories\VerticalInsightRepository;
use Illuminate\Contracts\Auth\Guard;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Cache;
use Illuminate\View\View;

final class HomeAnalyticsComposer
{

	public function compose(View $view): void
	{
		// Lightweight: don't try to pull real analytics in unit tests
		$view->with('home_analytics', []);
	}

}

