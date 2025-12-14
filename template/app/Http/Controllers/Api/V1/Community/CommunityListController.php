<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityGroup;
use App\Models\CommunityList;
use App\Services\CommunityMembershipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class CommunityListController extends Controller
{
    public function __construct(private readonly CommunityMembershipService $membershipService)
    {
    }

    public function store(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());
        $profile = $request->user()?->socialProfile;

        $data = $request->validate([
            'name' => ['required', 'string', 'max:140'],
            'slug' => ['nullable', 'string', 'max:160'],
            'type' => ['nullable', 'in:close_friends,spotlight,waitlist,alumni,custom'],
            'visibility' => ['nullable', 'in:private,members,public'],
            'filters' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $list = CommunityList::create([
            'community_group_id' => $community->getKey(),
            'owner_profile_id' => $profile?->getKey(),
            'name' => $data['name'],
            'slug' => $data['slug'] ?? Str::slug($data['name']).'-'.$community->getKey(),
            'type' => $data['type'] ?? 'custom',
            'visibility' => $data['visibility'] ?? 'private',
            'filters' => $data['filters'] ?? [],
            'metadata' => $data['metadata'] ?? [],
        ]);

        return response()->json([
            'ok' => true,
            'list' => $list,
        ], 201);
    }

    public function closeFriends(Request $request, CommunityGroup $community): JsonResponse
    {
        $profile = $request->user()?->socialProfile;
        $list = $community->closeFriendList()->with('entries.profile')->first();

        if (! $list && $profile) {
            $list = $this->membershipService->syncCloseFriendList($community, $profile);
            $list->load('entries.profile');
        }

        return response()->json([
            'list' => $list,
        ]);
    }

    protected function authorizeManagement(CommunityGroup $community, $user): void
    {
        if (! $community->canBeManagedBy($user)) {
            abort(403, 'Not authorized to manage this community.');
        }
    }
}

