<?php
/**
 * LocationController
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\State;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class LocationController extends Controller
{
    function getStatesOfCountry(string $countryId) : \Illuminate\Contracts\Routing\ResponseFactory|Response {
        $states = State::select(['id', 'name', 'country_id'])->where('country_id', $countryId)->get();
        return response($states);
    }
}

