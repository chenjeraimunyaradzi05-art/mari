<?php

namespace App\Http\Controllers\Frontend\Social;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Frontend\Social\Concerns\ManagesSocialProfiles;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\Social\SocialNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class FollowController extends Controller
{
    use ManagesSocialProfiles;

    public function __construct(
        private SocialNotificationService $notificationService,
        private RealTimeAnalyticsEngine $analytics
    ) {}

    public function store(Request $request, string $username): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 401);

        $currentProfile = $this->ensureProfile($user);
        $targetProfile = $this->resolveTargetProfile($username, $currentProfile);

        if ($currentProfile->id === $targetProfile->id) {
            return $this->respondWithError($request, 'You cannot follow your own profile.', 422);
        }

        $this->authorize('follow', $targetProfile);

        if ($currentProfile->isFollowing($targetProfile)) {
            return $this->respond($request, [
                'status' => 'already_following',
                'followers' => $targetProfile->followers_count,
                'following' => $currentProfile->following_count,
            ], 200, 'You are already following this profile.');
        }

        $currentProfile->following()->syncWithoutDetaching([
            $targetProfile->id => [
                'is_close_friend' => false,
                'notifications_enabled' => true,
                'followed_at' => now(),
            ],
        ]);

        $this->adjustCounter($targetProfile, 'followers_count', 1);
        $this->adjustCounter($currentProfile, 'following_count', 1);

        $this->notificationService->notifyFollowed($currentProfile, $targetProfile);

        $this->analytics->record('social.profile.followed', [
            'source' => 'social_graph',
            'properties' => [
                'actor_profile_id' => $currentProfile->id,
                'target_profile_id' => $targetProfile->id,
            ],
        ]);

        $targetProfile->refresh();
        $currentProfile->refresh();

        return $this->respond($request, [
            'status' => 'followed',
            'followers' => $targetProfile->followers_count,
            'following' => $currentProfile->following_count,
        ], 201, 'You are now following '.($targetProfile->display_name ?? $targetProfile->username ?? 'this profile').'.');
    }

    private function respond(Request $request, array $payload, int $status, ?string $flashMessage = null): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['data' => $payload], $status);
        }

        $redirect = redirect()->back();

        if ($flashMessage) {
            $status >= 400
                ? $redirect->withErrors(['follow' => $flashMessage])
                : $redirect->with('success', $flashMessage);
        }

        return $redirect;
    }

    private function respondWithError(Request $request, string $message, int $status): JsonResponse|RedirectResponse
    {
        return $this->respond($request, ['status' => 'error', 'message' => $message], $status, $message);
    }

    private function resolveTargetProfile(string $username, SocialProfile $currentProfile): SocialProfile
    {
        if ($username === 'me') {
            return $currentProfile;
        }

        $profile = SocialProfile::query()
            ->whereIdentifier($username)
            ->with('profileable')
            ->firstOrFail();

        return $profile;
    }

}

