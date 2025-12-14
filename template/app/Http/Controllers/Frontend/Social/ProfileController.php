<?php

namespace App\Http\Controllers\Frontend\Social;

use App\Exceptions\ImageDriverUnavailableException;
use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\MediaUploadService;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\Social\SocialNotificationService;
use App\Support\SocialMediaStorage;
use App\Support\SocialMetrics;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

final class ProfileController extends Controller
{
    private const HEALTH_INTEREST_META = [
        'wellness' => [
            'label' => 'Wellness focus',
            'icon' => 'fa-heartbeat',
            'hint' => 'General wellbeing rituals synced from Athena.',
        ],
        'yoga' => [
            'label' => 'Yoga practice',
            'icon' => 'fa-spa',
            'hint' => 'Flow, yin, or restorative streaks.',
        ],
        'pilates' => [
            'label' => 'Pilates strength',
            'icon' => 'fa-leaf',
            'hint' => 'Reformer or mat pilates focus pulled from the wellbeing hub.',
        ],
        'mobility' => [
            'label' => 'Mobility resets',
            'icon' => 'fa-sync-alt',
            'hint' => 'Mobility flows, fascia care, and gentle joint primers.',
        ],
        'breathwork' => [
            'label' => 'Breathwork practice',
            'icon' => 'fa-wind',
            'hint' => 'Guided breath cues and nervous-system support.',
        ],
        'run-club' => [
            'label' => 'Run club',
            'icon' => 'fa-running',
            'hint' => 'Group runs, pacer support, or solo jog rituals.',
        ],
        'cycle' => [
            'label' => 'Bike / cycle time',
            'icon' => 'fa-bicycle',
            'hint' => 'Spin sessions, commuter rides, or cycle tours.',
        ],
        'cardio' => [
            'label' => 'Cardio focus',
            'icon' => 'fa-bolt',
            'hint' => 'Intervals, heart-rate experiments, and aerobic play.',
        ],
        'strength' => [
            'label' => 'Strength training',
            'icon' => 'fa-dumbbell',
            'hint' => 'Lifting blocks, kettlebells, or bodyweight progressions.',
        ],
        'team' => [
            'label' => 'Team sport energy',
            'icon' => 'fa-users',
            'hint' => 'Social leagues, scrimmage nights, or community sport.',
        ],
        'outdoors' => [
            'label' => 'Outdoors time',
            'icon' => 'fa-tree',
            'hint' => 'Hikes, beach walks, bush runs, or nature clubs.',
        ],
        'trail' => [
            'label' => 'Trail / hike plans',
            'icon' => 'fa-hiking',
            'hint' => 'Trail adventures and elevation training from the wellbeing hub.',
        ],
        'swim' => [
            'label' => 'Swim rituals',
            'icon' => 'fa-swimmer',
            'hint' => 'Pool sets, ocean dips, or gentle aqua therapy.',
        ],
        'surf' => [
            'label' => 'Surf sessions',
            'icon' => 'fa-water',
            'hint' => 'Saltwater recoveries or surf club sign-ons.',
        ],
        'boxing' => [
            'label' => 'Boxing / pads',
            'icon' => 'fa-hand-rock',
            'hint' => 'Pads, bag work, or kickboxing conditioning.',
        ],
        'dance' => [
            'label' => 'Dance practice',
            'icon' => 'fa-music',
            'hint' => 'Movement labs, choreo jams, or free-form dance.',
        ],
        'meditation' => [
            'label' => 'Meditation cues',
            'icon' => 'fa-brain',
            'hint' => 'Mindfulness, NSDR, or guided calm sessions.',
        ],
        'vipassana' => [
            'label' => 'Vipassana sits',
            'icon' => 'fa-om',
            'hint' => 'Integration circles and silent sit refreshers.',
        ],
        'prenatal' => [
            'label' => 'Prenatal support',
            'icon' => 'fa-baby',
            'hint' => 'Pregnancy-safe stacks curated inside wellbeing.',
        ],
        'postnatal' => [
            'label' => 'Postnatal rebuild',
            'icon' => 'fa-child',
            'hint' => 'Pelvic floor and gentle return-to-movement notes.',
        ],
        'pelvic-floor' => [
            'label' => 'Pelvic floor care',
            'icon' => 'fa-feather-alt',
            'hint' => 'Restorative cues and clinical guidance reminders.',
        ],
        'hormone-health' => [
            'label' => 'Hormone literacy',
            'icon' => 'fa-tint',
            'hint' => 'Cycle-sync notes, perimenopause care, and labs.',
        ],
    ];

    private const HEALTH_INTEREST_ALIASES = [
        'run' => 'run-club',
        'running' => 'run-club',
        'mobility-flow' => 'mobility',
        'breathing' => 'breathwork',
        'cycling' => 'cycle',
        'bike' => 'cycle',
        'weights' => 'strength',
        'lifting' => 'strength',
        'cardio' => 'cardio',
        'trail-running' => 'trail',
        'hike' => 'trail',
        'hiking' => 'trail',
        'swimming' => 'swim',
        'surfing' => 'surf',
        'kickboxing' => 'boxing',
        'dancing' => 'dance',
        'mindfulness' => 'meditation',
        'antenatal' => 'prenatal',
        'postpartum' => 'postnatal',
        'pelvic_floor' => 'pelvic-floor',
        'pelvic' => 'pelvic-floor',
        'hormones' => 'hormone-health',
    ];
    public function __construct(
        private readonly SocialNotificationService $notificationService,
        private readonly RealTimeAnalyticsEngine $analytics,
        private readonly MediaUploadService $mediaUploads
    ) {
    }

    public function show(Request $request, string $username): View|RedirectResponse
    {
        [$profile, $wasAlias] = $this->resolveProfileFromRoute($username, $request->user(), true);

        if ($wasAlias) {
            return redirect()->route('social.profiles.show', $profile->username);
        }

        $this->authorize('view', $profile);

        $currentProfile = $request->user()?->socialProfile;
        $isOwner = $currentProfile?->id === $profile->id;
        $isFollowing = $currentProfile ? $currentProfile->isFollowing($profile) : false;

        $posts = $this->buildPostFeed($profile);

        $followers = $profile->followers()
            ->with('profileable')
            ->orderByDesc('social_follows.followed_at')
            ->take(12)
            ->get();

        $following = $profile->following()
            ->with('profileable')
            ->orderByDesc('social_follows.followed_at')
            ->take(12)
            ->get();

        $profileMetrics = SocialMetrics::forUser($profile->resolveOwnerUser());

        $this->analytics->record('social.profile.viewed', [
            'source' => 'social_profile',
            'properties' => [
                'profile_id' => $profile->id,
                'viewer_user_id' => $request->user()?->id,
                'viewer_profile_id' => $currentProfile?->id,
                'is_owner' => $isOwner,
                'is_following' => $isFollowing,
                'followers_preview_count' => $followers->count(),
                'following_preview_count' => $following->count(),
            ],
        ]);

        return view('social.profile.show', [
            'profile' => $profile,
            'posts' => $posts,
            'isOwner' => $isOwner,
            'isFollowing' => $isFollowing,
            'currentProfile' => $currentProfile,
            'followers' => $followers,
            'following' => $following,
            'profileMetrics' => $profileMetrics,
            'healthInterestChips' => $this->healthInterestChipsForProfile($profile),
        ]);
    }

    public function edit(Request $request, string $username): View|RedirectResponse
    {
        [$profile, $wasAlias] = $this->resolveProfileFromRoute($username, $request->user(), true);

        if (! $profile) {
            abort(404);
        }

        if ($wasAlias && $profile->username) {
            return redirect()->route('social.profiles.edit', $profile->username);
        }

        $this->authorize('update', $profile);

        $this->analytics->record('social.profile.edit.viewed', [
            'source' => 'social_profile',
            'properties' => [
                'profile_id' => $profile->id,
                'user_id' => $request->user()?->id,
            ],
        ]);

        return view('social.profile.edit', [
            'profile' => $profile,
            'linkSlots' => $this->prepareLinkSlots($profile->social_links ?? []),
        ]);
    }

    public function update(Request $request, string $username): RedirectResponse
    {
        [$profile] = $this->resolveProfileFromRoute($username, $request->user(), true);

        $this->authorize('update', $profile);

        $rules = [
            'display_name' => ['required', 'string', 'max:80'],
            'username' => [
                'required',
                'string',
                'max:50',
                'regex:/^[A-Za-z0-9_.-]+$/',
                Rule::unique('social_profiles', 'username')->ignore($profile->id),
            ],
            'bio' => ['nullable', 'string', 'max:2800'],
            'website' => ['nullable', 'url', 'max:200'],
            'profile_type' => ['nullable', 'string', 'max:40'],
            'is_private' => ['nullable', 'boolean'],
            'social_links' => ['nullable', 'array', 'max:5'],
            'social_links.*.label' => ['nullable', 'string', 'max:40'],
            'social_links.*.url' => ['nullable', 'url', 'max:255'],
            'avatar' => ['nullable', 'image', 'max:4096'],
            'cover_photo' => ['nullable', 'image', 'max:8192'],
            'profile_video' => ['nullable', 'file', 'mimetypes:video/mp4,video/quicktime,video/webm', 'max:153600'],
            'remove_profile_video' => ['nullable', 'boolean'],
        ];

        $validated = $request->validate($rules);

        if (empty($validated['username'])) {
            $validated['username'] = $this->generateUniqueUsername($validated['display_name'], $profile->id);
        }

        if ($request->hasFile('avatar')) {
            try {
                $this->deleteFile($profile->avatar);
                $validated['avatar'] = $this->mediaUploads->uploadAvatar($request->file('avatar'));
            } catch (ImageDriverUnavailableException $exception) {
                throw ValidationException::withMessages([
                    'avatar' => [$this->imageDriverUnavailableMessage()],
                ]);
            }
        } else {
            unset($validated['avatar']);
        }

        if ($request->hasFile('cover_photo')) {
            try {
                $this->deleteFile($profile->cover_photo);
                $validated['cover_photo'] = $this->mediaUploads->uploadCover($request->file('cover_photo'));
            } catch (ImageDriverUnavailableException $exception) {
                throw ValidationException::withMessages([
                    'cover_photo' => [$this->imageDriverUnavailableMessage()],
                ]);
            }
        } else {
            unset($validated['cover_photo']);
        }

        if ($request->hasFile('profile_video')) {
            $this->deleteFile($profile->profile_video);
            $this->deleteFile($profile->profile_video_thumbnail);
            $videoUpload = $this->mediaUploads->uploadProfileVideo($request->file('profile_video'));
            $validated['profile_video'] = $videoUpload['file_path'];
            $validated['profile_video_thumbnail'] = $videoUpload['thumbnail_path'] ?? null;
        } elseif ($request->boolean('remove_profile_video')) {
            $this->deleteFile($profile->profile_video);
            $this->deleteFile($profile->profile_video_thumbnail);
            $validated['profile_video'] = null;
            $validated['profile_video_thumbnail'] = null;
        } else {
            unset($validated['profile_video']);
        }

        unset($validated['remove_profile_video']);

        $links = collect($validated['social_links'] ?? [])
            ->map(fn (array $link) => [
                'label' => trim((string) ($link['label'] ?? '')),
                'url' => trim((string) ($link['url'] ?? '')),
            ])
            ->filter(fn (array $link) => filled($link['url']))
            ->map(function (array $link) {
                $label = $link['label'];
                if ($label === '') {
                    $label = Str::limit(parse_url($link['url'], PHP_URL_HOST) ?? 'Link', 40);
                }

                return [
                    'label' => $label,
                    'url' => $link['url'],
                ];
            })
            ->values()
            ->all();

        $profile->fill([
            'display_name' => $validated['display_name'],
            'username' => $validated['username'],
            'bio' => $validated['bio'] ?? null,
            'website' => $validated['website'] ?? null,
            'profile_type' => $validated['profile_type'] ?? $profile->profile_type,
            'is_private' => (bool) ($validated['is_private'] ?? false),
            'social_links' => $links,
        ]);

        if (isset($validated['avatar'])) {
            $profile->avatar = $validated['avatar'];
        }

        if (isset($validated['cover_photo'])) {
            $profile->cover_photo = $validated['cover_photo'];
        }

        if (array_key_exists('profile_video', $validated)) {
            $profile->profile_video = $validated['profile_video'];
        }

        if (array_key_exists('profile_video_thumbnail', $validated)) {
            $profile->profile_video_thumbnail = $validated['profile_video_thumbnail'];
        }

        $dirtyFields = array_keys($profile->getDirty());
        $profile->save();
        $profile->refresh();

        $changedFields = collect($dirtyFields)
            ->reject(fn ($field) => $field === 'updated_at')
            ->values()
            ->all();

        if (! empty($changedFields)) {
            $this->notificationService->notifyProfileUpdated($profile, $changedFields);
        }

        $this->analytics->record('social.profile.updated', [
            'source' => 'social_profile',
            'properties' => [
                'profile_id' => $profile->id,
                'user_id' => $request->user()->id,
                'changed_fields' => $changedFields,
            ],
        ]);

        return redirect()
            ->route('social.profiles.show', $profile->username)
            ->with('success', 'Profile updated successfully.');
    }

    public function uploadAvatar(Request $request, string $username): JsonResponse
    {
        [$profile] = $this->resolveProfileFromRoute($username, $request->user(), true);
        $this->authorize('uploadAvatar', $profile);

        $validated = $request->validate([
            'avatar' => ['required', 'image', 'max:5120'],
        ]);

        try {
            $this->deleteFile($profile->avatar);
            $profile->avatar = $this->mediaUploads->uploadAvatar($validated['avatar']);
            $profile->save();
        } catch (ImageDriverUnavailableException $exception) {
            throw ValidationException::withMessages([
                'avatar' => [$this->imageDriverUnavailableMessage()],
            ]);
        }

        return response()->json([
            'success' => true,
            'avatar_url' => $profile->refresh()->avatar_url,
        ]);
    }

    public function uploadCover(Request $request, string $username): JsonResponse
    {
        [$profile] = $this->resolveProfileFromRoute($username, $request->user(), true);
        $this->authorize('uploadCover', $profile);

        $validated = $request->validate([
            'cover_photo' => ['required', 'image', 'max:12288'],
        ]);

        try {
            $this->deleteFile($profile->cover_photo);
            $profile->cover_photo = $this->mediaUploads->uploadCover($validated['cover_photo']);
            $profile->save();
        } catch (ImageDriverUnavailableException $exception) {
            throw ValidationException::withMessages([
                'cover_photo' => [$this->imageDriverUnavailableMessage()],
            ]);
        }

        return response()->json([
            'success' => true,
            'cover_url' => $profile->refresh()->cover_url,
        ]);
    }

    public function followers(Request $request, string $username): JsonResponse|View
    {
        [$profile] = $this->resolveProfileFromRoute($username, $request->user(), true);
        $this->authorize('view', $profile);

        $paginator = $profile->followers()
            ->with('profileable')
            ->orderByDesc('social_follows.followed_at')
            ->paginate(20);

        $this->analytics->record('social.profile.followers.listed', [
            'source' => 'social_profile',
            'properties' => [
                'profile_id' => $profile->id,
                'viewer_user_id' => $request->user()?->id,
                'viewer_profile_id' => $request->user()?->socialProfile?->id,
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
            ],
        ]);

        if ($request->expectsJson()) {
            return $this->buildFollowResponse($paginator, $request->user()?->socialProfile);
        }

        return view('social.profile.followers', [
            'profile' => $profile,
            'followers' => $paginator,
            'currentProfile' => $request->user()?->socialProfile,
        ]);
    }

    public function following(Request $request, string $username): JsonResponse|View
    {
        [$profile] = $this->resolveProfileFromRoute($username, $request->user(), true);
        $this->authorize('view', $profile);

        $paginator = $profile->following()
            ->with('profileable')
            ->orderByDesc('social_follows.followed_at')
            ->paginate(20);

        $this->analytics->record('social.profile.following.listed', [
            'source' => 'social_profile',
            'properties' => [
                'profile_id' => $profile->id,
                'viewer_user_id' => $request->user()?->id,
                'viewer_profile_id' => $request->user()?->socialProfile?->id,
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
            ],
        ]);

        if ($request->expectsJson()) {
            return $this->buildFollowResponse($paginator, $request->user()?->socialProfile);
        }

        return view('social.profile.following', [
            'profile' => $profile,
            'following' => $paginator,
            'currentProfile' => $request->user()?->socialProfile,
        ]);
    }

    /**
     * @return (array|null)[]
     *
     * @psalm-return array<int, array|null>
     */
    private function healthInterestChipsForProfile(SocialProfile $profile): array
    {
        $owner = $profile->profileable;

        if (! $owner instanceof Profile) {
            return [];
        }

        $interests = is_array($owner->health_interests) ? $owner->health_interests : [];

        return collect($interests)
            ->filter(fn ($interest) => is_string($interest) && trim($interest) !== '')
            ->map(fn (string $interest) => $this->formatHealthInterestChip($interest))
            ->filter()
            ->unique(fn (array $chip) => $chip['token'])
            ->take(10)
            ->values()
            ->all();
    }

    /**
     * @return (null|string)[]|null
     *
     * @psalm-return array{token: string, label: string, icon: string, hint: null|string}|null
     */
    private function formatHealthInterestChip(string $interest): array|null
    {
        $normalized = Str::of($interest)
            ->lower()
            ->trim();

        if ($normalized->isEmpty()) {
            return null;
        }

        if ($normalized->startsWith('wellness:')) {
            $normalized = Str::of($normalized->after('wellness:'))->trim();
        }

        $token = $normalized->value();
        $canonical = self::HEALTH_INTEREST_ALIASES[$token] ?? $token;

        if (isset(self::HEALTH_INTEREST_META[$canonical])) {
            $meta = self::HEALTH_INTEREST_META[$canonical];

            return [
                'token' => $canonical,
                'label' => $meta['label'],
                'icon' => $meta['icon'],
                'hint' => $meta['hint'] ?? null,
            ];
        }

        if (str_starts_with($canonical, 'movement:')) {
            $level = Str::of(Str::after($canonical, 'movement:'))
                ->replace(['_', '-'], ' ')
                ->title()
                ->value();

            if ($level === '') {
                return null;
            }

            $iconMap = [
                'Gentle' => 'fa-feather-alt',
                'Steady' => 'fa-walking',
                'Power' => 'fa-running',
            ];

            return [
                'token' => $canonical,
                'label' => sprintf('%s movement focus', $level),
                'icon' => $iconMap[$level] ?? 'fa-shoe-prints',
                'hint' => 'Movement cadence synced from the wellbeing dashboard.',
            ];
        }

        if (str_starts_with($canonical, 'energy:')) {
            $pattern = Str::of(Str::after($canonical, 'energy:'))
                ->replace(['_', '-'], ' ')
                ->title()
                ->value();

            if ($pattern === '') {
                return null;
            }

            $lower = Str::of($pattern)->lower()->value();
            $icon = 'fa-clock';

            if (str_contains($lower, 'night') || str_contains($lower, 'eve')) {
                $icon = 'fa-moon';
            } elseif (str_contains($lower, 'sun') || str_contains($lower, 'morn')) {
                $icon = 'fa-sun';
            }

            return [
                'token' => $canonical,
                'label' => sprintf('%s energy pattern', $pattern),
                'icon' => $icon,
                'hint' => 'Energy timing preferences from the wellbeing hub.',
            ];
        }

        $clean = Str::of($canonical)
            ->replace(['_', '-'], ' ')
            ->title()
            ->value();

        if ($clean === '') {
            return null;
        }

        return [
            'token' => $canonical,
            'label' => $clean,
            'icon' => 'fa-sparkles',
            'hint' => null,
        ];
    }

    /**
     * @return (SocialProfile|bool|mixed|null)[]
     *
     * @psalm-return list{SocialProfile|mixed|null, bool}
     */
    private function resolveProfileFromRoute(string $username, ?User $user, bool $createIfMissing = false): array
    {
        if ($username === 'me' && $user) {
            $profile = $this->ensureProfile($user, $createIfMissing);

            if (! $profile->username) {
                $profile->username = $this->generateUniqueUsername($user->name, $profile->id);
                $profile->save();
            }

            return [$profile->fresh(), true];
        }

        $profile = SocialProfile::query()
            ->whereIdentifier($username)
            ->with('profileable')
            ->firstOrFail();

        return [$profile, false];
    }

    private function ensureProfile(User $user, bool $createIfMissing = false): \Illuminate\Database\Eloquent\Model|null
    {
        $profile = $user->socialProfile;

        if ($profile) {
            return $profile;
        }

        if (! $createIfMissing) {
            abort(404);
        }

        $profileType = $user->company ? 'company' : 'candidate';

        $profile = $user->socialProfile()->create([
            'profile_type' => $profileType,
            'display_name' => $user->name,
            'username' => $this->generateUniqueUsername($user->name),
            'social_links' => [],
        ]);

        return $profile->fresh();
    }

    private function buildPostFeed(SocialProfile $profile): LengthAwarePaginator
    {
        return $profile->posts()
            ->visible()
            ->with(['media', 'user.candidate', 'user.company', 'profile.profileable'])
            ->latest('published_at')
            ->paginate(12)
            ->withQueryString();
    }

    private function deleteFile(?string $path): void
    {
        SocialMediaStorage::delete($path);
    }

    private function imageDriverUnavailableMessage(): string
    {
        return 'Image processing is temporarily unavailable. Please try again later.';
    }

    private function generateUniqueUsername(string $base, ?int $ignoreId = null): string
    {
        $slug = Str::slug(Str::limit($base, 40, ''));

        if ($slug === '') {
            $slug = 'member';
        }

        $username = $slug;
        $suffix = 1;

        while (SocialProfile::query()
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->where('username', $username)
            ->exists()) {
            $username = $slug.'-'.$suffix;
            $suffix++;
        }

        return $username;
    }

    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return array<int<0, 2>, array{label: ''|mixed, url: ''|mixed}>
     */
    private function prepareLinkSlots(array $links): array
    {
        $links = array_values($links);
        $slots = [];

        for ($i = 0; $i < 3; $i++) {
            $slots[$i] = [
                'label' => $links[$i]['label'] ?? '',
                'url' => $links[$i]['url'] ?? '',
            ];
        }

        return $slots;
    }

    private function buildFollowResponse(LengthAwarePaginator $paginator, ?SocialProfile $currentProfile): JsonResponse
    {
        $items = collect($paginator->items())
            ->map(function (mixed $item) use ($currentProfile) {
                $profile = $item instanceof SocialProfile
                    ? $item
                    : (is_array($item) ? SocialProfile::hydrate([$item])->first() : null);

                if (! $profile instanceof SocialProfile) {
                    return null;
                }

                $owner = $profile->resolveOwnerUser();

                return [
                    'username' => $profile->username,
                    'display_name' => $profile->display_name ?? $owner?->name,
                    'avatar' => $profile->avatar_url,
                    'is_following' => $currentProfile ? $currentProfile->isFollowing($profile) : false,
                    'is_self' => $currentProfile?->id === $profile->id,
                ];
            })
            ->filter()
            ->values();

        return response()->json([
            'data' => $items,
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'has_more' => $paginator->hasMorePages(),
            ],
        ]);
    }
}

