<?php
/**
 * AboutUsPageController
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\About;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class AboutUsPageController extends Controller
{
    function index() : View {
        $about = About::first();
        $reviews = Review::latest()->take(10)->get();
        return view('frontend.pages.about-us', compact('about', 'reviews'));
    }
}

