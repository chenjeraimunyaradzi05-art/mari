<?php

namespace App\Http\Controllers\PublicSector;

use App\Http\Controllers\Controller;
use App\Models\PublicSectorAgency;
use App\Models\SocialProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class AgencyFollowController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth', 'verified']);
    }

    public function __invoke(Request $request, PublicSectorAgency $agency): JsonResponse
    {
        $userProfile = $this->ensureUserProfile($request);
        $agencyProfile = $agency->ensureSocialProfile();

        if ($userProfile->id === $agencyProfile->id) {
            return response()->json(['message' => 'Cannot follow your own profile'], 409);
        }

        $isFollowing = $userProfile->toggleFollow($agencyProfile);

        return response()->json([
            'success' => true,
            'is_following' => $isFollowing,
            'followers' => $agencyProfile->followers_count,
        ]);
    }

    private function ensureUserProfile(Request $request): SocialProfile
    {
        $user = $request->user();
        if ($user->socialProfile) {
            return $user->socialProfile;
        }

        $username = Str::slug($user->name.'-'.Str::random(6));

        return $user->socialProfile()->create([
            'username' => $username,
            'display_name' => $user->name,
            'profile_type' => 'citizen_leader',
            'bio' => 'Exploring public sector missions across Australia.',
        ]);
    }
}

