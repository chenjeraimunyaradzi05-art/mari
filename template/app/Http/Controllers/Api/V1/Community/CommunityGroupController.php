<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityGroup;
use App\Services\CommunityMembershipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class CommunityGroupController extends Controller
{
    public function __construct(private readonly CommunityMembershipService $membershipService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $groups = CommunityGroup::query()
            ->withCount('memberships')
            ->when($request->filled('visibility'), fn ($query) => $query->where('visibility', $request->string('visibility')))
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15));

        return response()->json($groups);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $profile = $user?->socialProfile;

        if (! $profile) {
            throw ValidationException::withMessages([
                'profile' => ['A social profile is required before creating a community.'],
            ]);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'tagline' => ['nullable', 'string', 'max:180'],
            'category' => ['required', 'string', 'in:industry,geographic,program,alumni,mentorship,resource'],
            'visibility' => ['required', 'string', 'in:public,private,secret'],
            'access_model' => ['required', 'string', 'in:open,request,invite,curated'],
            'focus_areas' => ['nullable', 'array'],
            'focus_areas.*' => ['string'],
            'region_scope' => ['nullable', 'string', 'max:120'],
            'requires_verification' => ['sometimes', 'boolean'],
            'member_limit' => ['nullable', 'integer', 'min:1'],
            'metadata' => ['nullable', 'array'],
        ]);

        $group = CommunityGroup::create(array_merge($data, [
            'owner_user_id' => $user->getKey(),
            'owner_profile_id' => $profile->getKey(),
        ]));

        $this->membershipService->bootstrap($group, $profile);

        return response()->json([
            'ok' => true,
            'community' => $group->fresh(['ownerProfile']),
        ], 201);
    }

    public function show(CommunityGroup $community): JsonResponse
    {
        $community->load(['ownerProfile', 'chapters', 'roles', 'memberships.profile']);

        return response()->json([
            'community' => $community,
        ]);
    }
}

