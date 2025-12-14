<?php

namespace App\Http\Controllers\WomenRealEstate;

use Illuminate\View\View;

final class RentalController
{
    public function index(): View
    {
        return view('women.real-estate.rentals.index');
    }

    public function seekerProfile(): View
    {
        return view('women.real-estate.househunters.profile');
    }

    public function matches(): View
    {
        return view('women.real-estate.househunters.matches');
    }

    public function connections(): View
    {
        return view('women.real-estate.social.connections');
    }
}

