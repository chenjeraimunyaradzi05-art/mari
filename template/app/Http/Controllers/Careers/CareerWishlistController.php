<?php

namespace App\Http\Controllers\Careers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

final class CareerWishlistController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();

        return view('careers.wishlist', [
            'user' => $user,
        ]);
    }
}

