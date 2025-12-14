<?php

namespace App\Http\Controllers\Business;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

final class FormationStudioController extends Controller
{
    public function __invoke(): View
    {
        return view('business.formation-studio');
    }
}

