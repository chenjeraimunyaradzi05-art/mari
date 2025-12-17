<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\OrganizationPage;
use App\Models\OrgPost;

class OrgPostController extends Controller
{
    public function store(string $slug, Request $request)
    {
        $page = OrganizationPage::where('slug', $slug)->firstOrFail();
        // TODO: authorize admin of this org page
        $data = $request->validate([
            'content' => ['nullable','string','max:2000'],
            'media_id' => ['nullable','integer'],
            'visibility' => ['required','in:public,followers'],
            'tags' => ['array']
        ]);

        $post = OrgPost::create([
            'org_page_id' => $page->id,
            'content' => $data['content'] ?? '',
            'media_id' => $data['media_id'] ?? null,
            'visibility' => $data['visibility'],
            'tags' => $data['tags'] ?? []
        ]);

        // TODO: fan out to feed, groups, notifications
        return response()->json($post, 201);
    }
}
