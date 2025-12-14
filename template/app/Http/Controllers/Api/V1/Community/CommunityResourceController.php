<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityGroup;
use App\Models\CommunityResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

final class CommunityResourceController extends Controller
{
    public function store(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());
        $profile = $request->user()?->socialProfile;

        $data = $request->validate([
            'community_chapter_id' => ['nullable', 'exists:community_chapters,id'],
            'resource_type' => ['required', 'string', 'in:guide,template,recording,deck,policy,link'],
            'source_type' => ['required', 'string', 'in:upload,external_link,note'],
            'title' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180'],
            'file' => ['nullable', 'file'],
            'external_url' => ['nullable', 'url'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string'],
            'visibility' => ['nullable', 'string', 'in:public,members,private'],
            'metadata' => ['nullable', 'array'],
        ]);

        $disk = config('filesystems.default', 'public');
        $filePath = null;

        if ($data['source_type'] === 'upload') {
            $file = $request->file('file');
            if (! $file) {
                return response()->json(['message' => 'Upload a file for this resource.'], 422);
            }

            $filePath = $file->store('community/resources', $disk);
        }

        $resource = CommunityResource::create([
            'community_group_id' => $community->getKey(),
            'community_chapter_id' => $data['community_chapter_id'] ?? null,
            'uploaded_by_profile_id' => $profile?->getKey(),
            'resource_type' => $data['resource_type'],
            'source_type' => $data['source_type'],
            'title' => $data['title'],
            'slug' => $data['slug'] ?? $this->generateSlug($data['title']),
            'disk' => $disk,
            'file_path' => $filePath,
            'external_url' => $data['external_url'] ?? null,
            'tags' => $data['tags'] ?? [],
            'visibility' => $data['visibility'] ?? 'members',
            'metadata' => $data['metadata'] ?? [],
        ]);

        return response()->json([
            'ok' => true,
            'resource' => $resource,
            'url' => $resource->file_path ? Storage::disk($disk)->url($resource->file_path) : $resource->external_url,
        ], 201);
    }

    protected function authorizeManagement(CommunityGroup $community, $user): void
    {
        if (! $community->canBeManagedBy($user)) {
            abort(403, 'Not authorized to manage this community.');
        }
    }

    protected function generateSlug(string $value): string
    {
        return str()->slug($value).'-'.str()->random(4);
    }
}

