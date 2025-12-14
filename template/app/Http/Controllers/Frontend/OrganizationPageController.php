<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\OrganizationPage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\View\View;

final class OrganizationPageController extends Controller
{
    public function show(string $slug, Request $request): View
    {
    $page = OrganizationPage::with([
        'company',
        'coverMedia' => fn ($query) => $query->visible(),
        'media' => fn ($query) => $query->visible()->latest()->limit(12),
                'posts' => fn ($query) => $query->with('media')->latest()->limit(6),
                'publishedCourses' => fn ($query) => $query
                    ->with(['intakes' => fn ($intake) => $intake->open()->orderBy('start_on')])
                    ->latest('published_at')
                    ->limit(3),
            ])
            ->withCount([
                'followers',
                'courses as published_courses_count' => fn (Builder $builder) => $builder->published(),
            ])
            ->where('slug', $slug)
            ->published()
            ->firstOrFail();

        return view('frontend.org-pages.show', [
            'page' => $page,
            'leadIntent' => $request->get('intent', $page->defaultLeadIntent()),
            'personaMeta' => $page->persona_meta,
            'coursePreview' => $page->publishedCourses,
            'courseCount' => $page->published_courses_count ?? 0,
        ]);
    }
}

