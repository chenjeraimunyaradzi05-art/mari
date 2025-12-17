<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use App\Models\OrganizationPage;
use App\Models\OrgPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OrgPostController extends Controller
{
	public function store(string $slug, Request $request): JsonResponse
	{
		$page = OrganizationPage::where('slug', $slug)->firstOrFail();

		$data = $request->validate([
			'title' => ['nullable','string','max:255'],
			'content' => ['nullable','string'],
			'media_id' => ['nullable','integer'],
			'visibility' => ['required','in:public,followers'],
			'tags' => ['nullable','array'],
			'scheduled_at' => ['nullable','date'],
		]);

		$post = OrgPost::create([
			'org_page_id' => $page->id,
			'title' => $data['title'] ?? null,
			'content' => $data['content'] ?? null,
			'media_id' => $data['media_id'] ?? null,
			'visibility' => $data['visibility'],
			'tags' => $data['tags'] ?? [],
			'scheduled_at' => $data['scheduled_at'] ?? null,
			'published_at' => $data['scheduled_at'] ? null : now(),
		]);

		return response()->json($post, 201);
	}
}

