<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use App\Models\OrganizationPage;
use App\Services\OrgMedia\OrgMediaUploader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OrgMediaController extends Controller
{
	public function __construct(private readonly OrgMediaUploader $uploader)
	{
	}

	public function store(string $slug, Request $request): JsonResponse
	{
		$page = OrganizationPage::where('slug', $slug)->firstOrFail();

		$data = $request->validate([
			'file' => ['required','file','mimetypes:video/*,image/*','max:'.config('org.max_upload_size', 524288)],
			'type' => ['required','in:video,image'],
			'mark_as_cover' => ['sometimes','boolean'],
		]);

		try {
			$media = $this->uploader->upload($page, $request->file('file'), $data['type']);
		} catch (\RuntimeException $exception) {
			return response()->json(['message' => $exception->getMessage()], 422);
		}

		if ($request->boolean('mark_as_cover')) {
			$page->cover_media_id = $media->id;
			$page->save();
		}

		return response()->json($media->fresh(), 201);
	}
}

