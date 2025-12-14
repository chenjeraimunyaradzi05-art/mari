<?php

namespace App\View\Composers\Frontend;

use App\Services\Advertising\HomepageSponsorService;
use Illuminate\View\View;

final class HomepageSponsorComposer
{
    private array $slots;

    public function compose(View $view): void
    {
        // Keep sponsor payload lightweight during tests
        $view->with('homepage_sponsors', []);
    }
}

