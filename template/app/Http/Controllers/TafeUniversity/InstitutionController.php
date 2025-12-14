<?php

namespace App\Http\Controllers\TafeUniversity;

use App\Http\Controllers\Controller;
use App\Models\SocialPost;
use App\Models\TafeInstitution;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

final class InstitutionController extends Controller
{
    public function show(TafeInstitution $institution, Request $request): View
    {
        $institution->load(['programs' => fn ($query) => $query->with('intakes')->published()]);

        $socialPosts = SocialPost::with(['profile', 'media'])
            ->public()
            ->visible()
            ->where(function ($query) use ($institution) {
                $query->whereHas('profile', function ($profileQuery) use ($institution) {
                    $profileQuery->where('profileable_type', TafeInstitution::class)
                        ->where('profileable_id', $institution->id);
                })
                    ->orWhere('tags', 'like', "%{$institution->slug}%");
            })
            ->orderByDesc('published_at')
            ->take(9)
            ->get();

        return view('education.tafe.institutions.show', [
            'institution' => $institution,
            'programs' => $institution->programs,
            'socialPosts' => $socialPosts,
        ]);
    }
}

