<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\AdCreative;

class AdCreativeController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'campaign_id' => ['required','integer','exists:ad_campaigns,id'],
            'media_id' => ['required','integer'],
            'caption' => ['nullable','string','max:500'],
            'cta' => ['nullable','string','max:80'],
            'deeplink' => ['nullable','string','max:500'],
        ]);

        $creative = AdCreative::create($data);
        return response()->json($creative, 201);
    }
}
