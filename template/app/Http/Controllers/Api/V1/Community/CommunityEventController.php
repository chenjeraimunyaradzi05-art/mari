<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityEvent;
use App\Models\CommunityGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class CommunityEventController extends Controller
{
    public function store(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());

        $data = $request->validate([
            'community_chapter_id' => ['nullable', 'exists:community_chapters,id'],
            'mentorship_cohort_id' => ['nullable', 'exists:mentorship_cohorts,id'],
            'title' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180'],
            'event_type' => ['required', 'in:workshop,ama,meetup,live_room,cohort_session'],
            'format' => ['required', 'in:virtual,in_person,hybrid'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'location' => ['nullable', 'string', 'max:255'],
            'stream_url' => ['nullable', 'url'],
            'visibility' => ['nullable', 'in:public,members,invite'],
            'metadata' => ['nullable', 'array'],
        ]);

        $profile = $request->user()?->socialProfile;

        $event = CommunityEvent::create([
            'community_group_id' => $community->getKey(),
            'community_chapter_id' => $data['community_chapter_id'] ?? null,
            'mentorship_cohort_id' => $data['mentorship_cohort_id'] ?? null,
            'created_by_profile_id' => $profile?->getKey(),
            'title' => $data['title'],
            'slug' => $data['slug'] ?? Str::slug($data['title']).'-'.Str::random(4),
            'event_type' => $data['event_type'],
            'format' => $data['format'],
            'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'] ?? null,
            'timezone' => $data['timezone'] ?? config('app.timezone'),
            'capacity' => $data['capacity'] ?? null,
            'location' => $data['location'] ?? null,
            'stream_url' => $data['stream_url'] ?? null,
            'metadata' => $data['metadata'] ?? [],
            'visibility' => $data['visibility'] ?? 'members',
            'status' => 'published',
        ]);

        return response()->json([
            'ok' => true,
            'event' => $event,
        ], 201);
    }

    protected function authorizeManagement(CommunityGroup $community, $user): void
    {
        if (! $community->canBeManagedBy($user)) {
            abort(403, 'Not authorized to manage this community.');
        }
    }
}

