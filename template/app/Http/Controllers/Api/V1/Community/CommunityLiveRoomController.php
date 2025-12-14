<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityGroup;
use App\Models\CommunityLiveRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class CommunityLiveRoomController extends Controller
{
    public function store(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());
        $profile = $request->user()?->socialProfile;

        $data = $request->validate([
            'community_event_id' => ['nullable', 'exists:community_events,id'],
            'topic' => ['required', 'string', 'max:160'],
            'room_type' => ['nullable', 'in:audio,video'],
            'max_speakers' => ['nullable', 'integer', 'min:1', 'max:50'],
            'max_listeners' => ['nullable', 'integer', 'min:1', 'max:5000'],
            'starts_at' => ['nullable', 'date'],
        ]);

        $liveRoom = CommunityLiveRoom::create([
            'community_group_id' => $community->getKey(),
            'community_event_id' => $data['community_event_id'] ?? null,
            'host_profile_id' => $profile?->getKey(),
            'topic' => $data['topic'],
            'room_type' => $data['room_type'] ?? 'audio',
            'starts_at' => $data['starts_at'] ?? now()->addMinutes(10),
            'max_speakers' => $data['max_speakers'] ?? 8,
            'max_listeners' => $data['max_listeners'] ?? 250,
            'state' => 'scheduled',
        ]);

        return response()->json([
            'ok' => true,
            'live_room' => $liveRoom,
        ], 201);
    }

    protected function authorizeManagement(CommunityGroup $community, $user): void
    {
        if (! $community->canBeManagedBy($user)) {
            abort(403, 'Not authorized to manage this community.');
        }
    }
}

