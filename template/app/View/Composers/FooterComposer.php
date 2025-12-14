<?php

namespace App\View\Composers;

use App\Models\Footer;
use App\Models\SocialIcon;
use Illuminate\View\View;
use Illuminate\Support\Facades\Cache;

final class FooterComposer
{
    /**
     * Bind data to the view.
     * Cache footer data for 1 hour to prevent repeated database queries
     */
    public function compose(View $view): void
    {
        $footerDetails = Cache::remember('footer_details', 3600, function () {
            return Footer::first();
        });

        $footerIcons = Cache::remember('footer_icons', 3600, function () {
            return SocialIcon::all();
        });

        $view->with([
            'footerDetails' => $footerDetails,
            'footerIcons' => $footerIcons
        ]);
    }
}

