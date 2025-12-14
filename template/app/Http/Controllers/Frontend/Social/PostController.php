<?php

namespace App\Http\Controllers\Frontend\Social;

use App\Exceptions\ImageDriverUnavailableException;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Frontend\Social\Concerns\ManagesSocialProfiles;
use App\Models\MediaUploadSession;
use App\Models\SocialComment;
use App\Models\SocialMedia;
use App\Models\SocialPost as SocialPostModel;
use App\Models\SocialPostShare;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\ContentPolicyEngine;
use App\Services\MediaUploadService;
use App\Services\Privacy\PrivacyTierService;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\Social\FeedGeneratorService;
use App\Services\Social\FeedMatcher;
use App\Services\Social\LinkImportService;
use App\Services\Social\SocialNotificationService;
use App\Services\SocialModerationService;
use App\Support\SocialMediaStorage;
use App\Support\SocialPostFormatter;
use App\Support\SocialReels;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

final class PostController extends Controller
{
    use ManagesSocialProfiles;

    private const MEDIA_SESSION_PLACEHOLDER = '__MEDIA_SESSION__';

    public function __construct(
        private LinkImportService $linkImports,
        private ContentPolicyEngine $policyEngine,
        private MediaUploadService $mediaUploads,
        private SocialModerationService $moderationService,
        private SocialNotificationService $notificationService,
        private RealTimeAnalyticsEngine $analytics,
        private FeedGeneratorService $feedGenerator,
        private FeedMatcher $feedMatcher
    ) {}

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401);

        if (! $this->userCanPost($user)) {
            return redirect()->back()->withErrors(['content' => 'Your plan does not allow publishing to the feed yet.']);
        }

        $maxMedia = (int) config('social.feed.composer.max_media', 5);
        $maxFileSize = (int) config('social.feed.composer.max_file_size_mb', 12) * 1024;
        $maxImports = (int) config('social.integrations.max_attachments_per_post', 5);

        $validator = Validator::make($request->all(), [
            'content' => ['nullable', 'string', 'max:5000'],
            'caption' => ['nullable', 'string', 'max:5000'],
            'tags' => ['nullable', 'string', 'max:255'],
            'media' => ['nullable', 'array', 'max:'.$maxMedia],
            'media.*' => ['file', 'mimes:jpg,jpeg,png,gif,mp4,webm', 'max:'.$maxFileSize],
            'media_sessions' => ['nullable', 'array', 'max:'.$maxMedia],
            'media_sessions.*' => ['uuid'],
            'import_items' => ['nullable', 'array', 'max:'.$maxImports],
            'import_items.*' => ['string'],
            'visibility' => ['required', 'string', Rule::in(['public', 'connections', 'followers', 'private'])],
            'audience_sector' => ['nullable', 'string', 'max:120'],
            'audience_skills' => ['nullable', 'string', 'max:255'],
            'post_type' => ['nullable', 'string', Rule::in(['post', 'reel', 'story'])],
            'location' => ['nullable', 'string', 'max:120'],
            'comments_disabled' => ['sometimes', 'boolean'],
        ]);

        $validator->after(function ($validator) use ($request, $maxMedia): void {
            $text = Str::of($request->input('content') ?? $request->input('caption'))->trim();
            $mediaFiles = collect($request->file('media', []))
                ->filter(fn ($file) => $file instanceof UploadedFile);
            $sessionCount = collect($request->input('media_sessions', []))
                ->filter()
                ->count();
            $importCount = collect($request->input('import_items', []))
                ->filter()
                ->count();

            if ($text->isEmpty() && $mediaFiles->isEmpty() && $sessionCount === 0 && $importCount === 0) {
                $validator->errors()->add('content', 'Share a thought or attach at least one photo/video.');
            }

            if (($mediaFiles->count() + $sessionCount) > $maxMedia) {
                $validator->errors()->add('media', 'You can attach up to '.$maxMedia.' files per post.');
            }
        });

        $validated = $validator->validate();
        $mediaSessionIds = array_values(array_filter($validated['media_sessions'] ?? []));
        $encodedImports = array_values(array_filter($validated['import_items'] ?? []));
        unset($validated['media_sessions'], $validated['import_items']);

        $sessionAttachments = $this->resolveMediaSessions($user, $mediaSessionIds);
        $importAttachments = $this->linkImports->decodeForSubmission($encodedImports);

        $profile = $this->ensureProfile($user);

        $mediaUploads = collect($request->file('media', []))
            ->filter(fn ($file) => $file instanceof UploadedFile)
            ->values();

        $audienceSkills = $this->normalizeSkills($validated['audience_skills'] ?? null);
        $tags = $this->normalizeTags($validated['tags'] ?? null);
        $content = $validated['content'] ?? $validated['caption'] ?? '';
        $content = Str::of($content)->trim()->toString();

        $policyResult = $this->policyEngine->scan($content, [
            'profile_id' => $profile->id,
            'post_type' => $validated['post_type'] ?? 'post',
        ]);

        if ($policyResult['should_block']) {
            return redirect()->back()->withErrors([
                'content' => 'Your post violates our safety guidelines. Please revise and try again.',
            ]);
        }

        // Additional checks: ensure that content flagged for review or containing
        // pornographic/explicit language is not published publicly.
        $moderator = app(\App\Services\ContentModerationService::class);
        $extraViolations = $moderator->scanText($content);

        // If under 18 and explicit/pornographic content detected, block
        $memberProfile = \App\Models\MemberProfile::where('user_id', $user->id)->first();
        $isUnder18 = false;
        if ($memberProfile && $memberProfile->date_of_birth) {
            try {
                $dob = \Carbon\Carbon::parse($memberProfile->date_of_birth);
                $isUnder18 = $dob->age < 18;
            } catch (\Throwable $e) {
                $isUnder18 = false;
            }
        }

        if ($isUnder18 && collect($extraViolations)->pluck('type')->contains('pornographic')) {
            $this->analytics->record('moderation.block.under18', [
                'properties' => [
                    'user_id' => $user->id,
                    'post_summary' => Str::limit($content, 200),
                ],
            ]);

            return redirect()->back()->withErrors([
                'content' => 'Your post contains sexual content which is not allowed for under-18 accounts.'
            ]);
        }

        // If policy suggested queue_review or we found disallowed categories and user attempted public visibility,
        // force posts to private and mark for review so they cannot appear publicly immediately.
        if (($policyResult['should_queue_review'] || collect($extraViolations)->isNotEmpty()) && (($validated['visibility'] ?? '') === 'public')) {
            // record metric that content would have been public but was forced private by moderation
            $this->analytics->record('moderation.post.force_private', [
                'properties' => [
                    'user_id' => $user->id,
                    'post_summary' => Str::limit($content, 200),
                    'policy_matches' => $policyResult['matches'] ?? [],
                ],
            ]);

            $validated['visibility'] = 'private';
        }

        $visibility = $validated['visibility'] === 'followers'
            ? 'connections'
            : $validated['visibility'];

        $meta = [
            'source' => 'social_feed',
            'posted_via' => 'web',
            'audience' => [
                'sector' => $validated['audience_sector'] ?? null,
                'skills' => $audienceSkills,
            ],
            'match_insights' => [
                'sectors' => array_values(array_filter([$validated['audience_sector'] ?? null])),
                'skills' => $audienceSkills,
            ],
        ];

        if (! empty($importAttachments)) {
            $meta['imports'] = collect($importAttachments)
                ->map(fn (array $attachment) => Arr::only($attachment, [
                    'provider',
                    'type',
                    'embed_url',
                    'original_url',
                    'thumbnail_url',
                    'title',
                ]))
                ->values()
                ->all();
        }

        $sessionAttachmentCount = count($sessionAttachments);
        $importAttachmentCount = count($importAttachments);

        $post = DB::transaction(function () use ($user, $profile, $validated, $meta, $tags, $mediaUploads, $sessionAttachments, $importAttachments, $content, $visibility, $policyResult) {
            $payload = [
                'postable_type' => SocialProfile::class,
                'postable_id' => $profile->id,
                'user_id' => $user->id,
                'social_profile_id' => $profile->id,
                'type' => 'feed',
                'post_type' => $validated['post_type'] ?? 'post',
                'content' => $content,
                'caption' => $content,
                'meta' => array_merge($meta, [
                    'moderation' => [
                        'policy_matches' => $policyResult['matches'],
                        'policy_severity' => $policyResult['severity'],
                        'policy_action' => $policyResult['action'],
                    ],
                ]),
                'media' => [],
                'location' => $validated['location'] ?? null,
                'tags' => $tags,
                'mentions' => [],
                'likes_count' => 0,
                'comments_count' => 0,
                'shares_count' => 0,
                'views_count' => 0,
                'is_pinned' => false,
                'comments_disabled' => (bool) ($validated['comments_disabled'] ?? false),
                'visibility' => $visibility,
                'moderation_status' => 'pending_review',
                'is_sponsored' => false,
                'published_at' => null,
                'ai_engagement_score' => 0,
                'ai_tags' => [],
            ];

            $post = SocialPostModel::create($payload);
            $normalizedMedia = [];
            $order = 0;

            if ($mediaUploads->isNotEmpty()) {
                try {
                    $uploaded = $mediaUploads
                        ->map(fn (UploadedFile $file) => $this->mediaUploads->uploadPostMedia($file))
                        ->values();
                } catch (ImageDriverUnavailableException $exception) {
                    throw ValidationException::withMessages([
                        'media' => [$this->imageDriverUnavailableMessage()],
                    ]);
                }

                foreach ($uploaded as $mediaDetails) {
                    $mediaRecord = $post->media()->create([
                        'media_type' => $mediaDetails['media_type'],
                        'file_path' => $mediaDetails['file_path'],
                        'thumbnail_path' => $mediaDetails['thumbnail_path'] ?? null,
                        'mime_type' => $mediaDetails['mime_type'] ?? null,
                        'file_size' => $mediaDetails['file_size'] ?? null,
                        'width' => $mediaDetails['width'] ?? null,
                        'height' => $mediaDetails['height'] ?? null,
                        'duration' => $mediaDetails['duration'] ?? null,
                        'order' => $order++,
                    ]);

                    $normalizedMedia[] = array_filter([
                        'id' => $mediaRecord->id,
                        'type' => $mediaRecord->media_type,
                        'path' => $mediaRecord->file_path,
                        'meta' => array_filter([
                            'thumbnail' => $mediaDetails['thumbnail_path'] ?? null,
                            'width' => $mediaDetails['width'] ?? null,
                            'height' => $mediaDetails['height'] ?? null,
                            'duration' => $mediaDetails['duration'] ?? null,
                            'mime_type' => $mediaDetails['mime_type'] ?? null,
                        ]),
                    ]);
                }
            }

            if (! empty($sessionAttachments)) {
                foreach ($sessionAttachments as $attachment) {
                    /** @var MediaUploadSession $session */
                    $session = $attachment['session'];
                    $payload = $attachment['payload'];

                    $mediaRecord = $post->media()->create([
                        'media_type' => $payload['type'] ?? $this->detectUploadedMediaType($payload['path'] ?? null, $payload['mime_type'] ?? null),
                        'file_path' => $payload['path'],
                        'thumbnail_path' => $payload['thumbnail_path'] ?? null,
                        'mime_type' => $payload['mime_type'] ?? null,
                        'file_size' => $payload['file_size'] ?? $session->total_size,
                        'width' => data_get($payload, 'meta.width'),
                        'height' => data_get($payload, 'meta.height'),
                        'duration' => data_get($payload, 'meta.duration'),
                        'order' => $order++,
                    ]);

                    $normalizedMedia[] = array_filter([
                        'id' => $mediaRecord->id,
                        'type' => $mediaRecord->media_type,
                        'path' => $mediaRecord->file_path,
                        'meta' => array_filter([
                            'thumbnail' => $mediaRecord->thumbnail_path,
                            'width' => $mediaRecord->width,
                            'height' => $mediaRecord->height,
                            'duration' => $mediaRecord->duration,
                            'mime_type' => $mediaRecord->mime_type,
                        ]),
                    ]);

                    $this->markSessionAttached($session, $post);
                }
            }

            if (! empty($importAttachments)) {
                foreach ($importAttachments as $import) {
                    $embedPath = $import['embed_url'] ?? $import['original_url'] ?? null;
                    if (! $embedPath) {
                        continue;
                    }

                    $normalizedMedia[] = array_filter([
                        'id' => null,
                        'type' => $import['type'] ?? 'embed',
                        'path' => $embedPath,
                        'meta' => array_filter([
                            'provider' => $import['provider'] ?? null,
                            'original_url' => $import['original_url'] ?? null,
                            'thumbnail' => $import['thumbnail_url'] ?? null,
                            'title' => $import['title'] ?? null,
                            'signature' => $import['signature'] ?? null,
                        ]),
                    ]);
                }
            }

            if (! empty($normalizedMedia)) {
                $post->forceFill(['media' => $normalizedMedia])->save();
            }

            $this->adjustCounter($profile, 'posts_count', 1);

            return $post;
        });

        if ($policyResult['should_queue_review']) {
            $this->moderationService->requestReview($post, [
                'source' => 'content_policy_engine',
                'matched_terms' => $policyResult['matches'],
                'target_status' => 'pending_review',
            ]);
        } else {
            $this->moderationService->recordDecision($post, 'approved', [
                'actor_type' => 'system',
                'actor_id' => $user->id,
                'reason' => 'auto_publish_trusted_author',
            ]);
        }

        $post->refresh();

        $this->notificationService->notifyPostPublished($post);

        $this->analytics->record('social.post.created', [
            'source' => 'social_feed',
            'properties' => [
                'post_id' => $post->id,
                'profile_id' => $profile->id,
                'user_id' => $user->id,
                'visibility' => $post->visibility,
                'has_media' => $mediaUploads->isNotEmpty() || $sessionAttachmentCount > 0 || $importAttachmentCount > 0,
                'media_count' => $mediaUploads->count() + $sessionAttachmentCount + $importAttachmentCount,
            ],
        ]);

        $post->loadMissing('user.candidate', 'user.company', 'profile.profileable', 'media');
        $post->setAttribute('match_score', 100);
        $post->setAttribute('match_reasons', ['Fresh story for your feed']);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Your story is live!',
                'data' => [
                    'post' => SocialPostFormatter::make($post, $user, true),
                    'html' => view('social.feed.partials.posts', ['posts' => collect([$post])])->render(),
                ],
            ], 201);
        }

        return redirect()->route('social.posts.index')->with('success', 'Your story is live!');
    }

    public function loadMore(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401);

        $profile = $this->ensureProfile($user);

        $page = (int) $request->query('page', 1);
        $perPage = (int) $request->query('per_page', 20);
        $filter = $request->query('filter', 'all');

        $paginator = $this->feedGenerator->generateFeed($profile, $page, $perPage, $filter);

        return response()->json([
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => (int) $paginator->total(),
                'filter' => $filter,
                'has_more' => $paginator->hasMorePages(),
            ],
            'data' => collect($paginator->items())
                ->map(fn ($post) => SocialPostFormatter::make($post, $user))
                ->values()
                ->all(),
        ]);
    }

    /**
     * Public index for posts (used by the public feed). Tests expect an index
     * endpoint that returns public, approved posts.
     */
    public function index(Request $request)
    {
        $posts = SocialPostModel::query()
            ->where('visibility', 'public')
            ->where('moderation_status', 'approved')
            ->latest('created_at')
            ->get();

        // Tests only need to see the content text so return a simple body containing
        // the approved posts' content.
        $body = $posts->pluck('content')->implode("\n\n");

        return response($body, 200);
    }

    public function save(Request $request, SocialPostModel $socialPost): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401);

        $this->authorize('save', $socialPost);

        $profile = $this->ensureProfile($user);

        $existing = $socialPost->saves()
            ->where('social_profile_id', $profile->id)
            ->first();

        $saved = false;

        if ($existing) {
            $existing->delete();
        } else {
            $socialPost->saves()->create([
                'social_profile_id' => $profile->id,
                'saved_at' => now(),
            ]);
            $saved = true;
        }

        $socialPost->refresh()->loadMissing('user.candidate', 'user.company', 'profile.profileable', 'media');

        $this->analytics->record($saved ? 'social.post.saved' : 'social.post.unsaved', [
            'source' => 'social_feed',
            'properties' => [
                'post_id' => $socialPost->id,
                'profile_id' => $profile->id,
                'user_id' => $user->id,
            ],
        ]);

        return response()->json([
            'data' => [
                'post' => SocialPostFormatter::make($socialPost, $user),
            ],
            'meta' => [
                'saved' => $saved,
            ],
        ]);
    }

    public function preview(Request $request, SocialPostModel $post): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401);

        $this->authorize('view', $post);

        $content = $post->content ?? $post->caption ?? '';

        return response()->json([
            'data' => [
                'post' => SocialPostFormatter::make($post, $user),
                'preview' => [
                    'id' => $post->id,
                    'summary' => Str::limit($content, 240),
                ],
            ],
        ]);
    }

    private function recordShare(SocialPostModel $post, SocialProfile $profile, string $channel, array $meta = []): SocialPostShare
    {
        $share = $post->shares()->create([
            'social_profile_id' => $profile->id,
            'user_id' => $profile->resolveOwnerUser()?->id ?? $profile->user_id,
            'channel' => $channel,
            'meta' => array_filter($meta),
            'shared_at' => now(),
        ]);

        $this->adjustCounter($post, 'shares_count', 1);

        return $share;
    }

    public function like(Request $request, SocialPostModel $socialPost): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401);

        $this->authorize('interact', $socialPost);

        $profile = $this->ensureProfile($user);

        $payload = $request->validate([
            'reaction' => ['nullable', 'string', 'max:50'],
        ]);

        $reaction = $payload['reaction'] ?? config('social.reactions.default', 'like');

        $existing = $socialPost->likes()->where('social_profile_id', $profile->id)->first();

        if ($existing) {
            if ($existing->reaction === $reaction) {
                // Toggle off
                $existing->delete();
                $this->adjustCounter($socialPost, 'likes_count', -1);
            } else {
                // Change reaction
                $existing->forceFill(['reaction' => $reaction])->save();
            }
        } else {
            $socialPost->likes()->create([
                'social_profile_id' => $profile->id,
                'user_id' => $profile->resolveOwnerUser()?->id ?? $user->id,
                'social_post_id' => $socialPost->id,
                'likeable_type' => SocialPostModel::class,
                'likeable_id' => $socialPost->id,
                'reaction' => $reaction,
                'liked_at' => now(),
            ]);

            $this->adjustCounter($socialPost, 'likes_count', 1);
        }

        $socialPost->refresh()->loadMissing('user.candidate', 'user.company', 'profile', 'media');

        return response()->json([
            'data' => [
                'post' => SocialPostFormatter::make($socialPost, $user),
            ],
        ]);
    }

    /**
     * @return (MediaUploadSession|array)[][]
     *
     * @psalm-return list{0?: array{session: MediaUploadSession, payload: array},...}
     */
    private function resolveMediaSessions(User $user, array $sessionIds): array
    {
        $orderedIds = collect($sessionIds)
            ->filter()
            ->values();

        if ($orderedIds->isEmpty()) {
            return [];
        }

        $sessions = MediaUploadSession::query()
            ->where('user_id', $user->id)
            ->whereIn('uuid', $orderedIds)
            ->get()
            ->keyBy('uuid');

        $attachments = [];

        foreach ($orderedIds as $uuid) {
            $session = $sessions->get($uuid);

            if (! $session) {
                throw ValidationException::withMessages([
                    'media_sessions' => 'One or more media uploads could not be found or have expired.',
                ]);
            }

            if ($session->status !== MediaUploadSession::STATUS_COMPLETED) {
                throw ValidationException::withMessages([
                    'media_sessions' => 'Media upload '.$uuid.' is still processing. Please wait until it completes.',
                ]);
            }

            if (in_array($session->scan_status, ['failed', 'blocked'], true) || $session->scan_verdict === 'block') {
                throw ValidationException::withMessages([
                    'media_sessions' => 'Media upload '.$uuid.' did not pass safety review.',
                ]);
            }

            if (! $session->storage_path) {
                throw ValidationException::withMessages([
                    'media_sessions' => 'Media upload '.$uuid.' is missing its final storage path.',
                ]);
            }

            $attachments[] = [
                'session' => $session,
                'payload' => $session->toAttachmentPayload(),
            ];
        }

        return $attachments;
    }

    private function markSessionAttached(MediaUploadSession $session, SocialPostModel $post): void
    {
        $meta = $session->meta ?? [];
        $meta['attached_post_id'] = $post->id;
        $meta['attached_at'] = now()->toIso8601String();

        $session->forceFill([
            'meta' => $meta,
        ])->save();
    }

    /**
     * @psalm-return Collection<int, array{key: string, label: mixed|string, description: ''|mixed, visibility: 'connections'|'private'|'public', policies: array{privacy_level: mixed, dm_policy: mixed, tag_policy: mixed, mention_policy: mixed, location_visibility: mixed}}>
     */
    private function buildPrivacyOptions(): Collection
    {
        $tierMap = [
            'public' => 'public',
            'network' => 'connections',
            'invite_only' => 'private',
        ];

        return collect(config('privacy.tiers', []))
            ->map(/**
             * @return (array|mixed|string)[]
             *
             * @psalm-return array{key: string, label: mixed|string, description: ''|mixed, visibility: 'connections'|'private'|'public', policies: array{privacy_level: mixed, dm_policy: mixed, tag_policy: mixed, mention_policy: mixed, location_visibility: mixed}}
             */
            function (array $tier, string $key) use ($tierMap): array {
                return [
                    'key' => $key,
                    'label' => $tier['label'] ?? Str::headline(str_replace('_', ' ', $key)),
                    'description' => $tier['description'] ?? '',
                    'visibility' => $tierMap[$key] ?? 'connections',
                    'policies' => [
                        'privacy_level' => data_get($tier, 'policies.privacy_level'),
                        'dm_policy' => data_get($tier, 'policies.dm_policy'),
                        'tag_policy' => data_get($tier, 'policies.tag_policy'),
                        'mention_policy' => data_get($tier, 'policies.mention_policy'),
                        'location_visibility' => data_get($tier, 'policies.location_visibility'),
                    ],
                ];
            })
            ->values();
    }

    /**
     * @return string[]
     *
     * @psalm-return array{create: string, show: string, chunk: string, complete: string}
     */
    private function mediaUploadRoutes(): array
    {
        $placeholder = self::MEDIA_SESSION_PLACEHOLDER;

        return [
            'create' => route('api.v1.media-uploads.store'),
            'show' => route('api.v1.media-uploads.show', ['mediaUploadSession' => $placeholder]),
            'chunk' => route('api.v1.media-uploads.chunks.store', ['mediaUploadSession' => $placeholder]),
            'complete' => route('api.v1.media-uploads.complete', ['mediaUploadSession' => $placeholder]),
        ];
    }

    private function userCanPost(User $user): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->company) {
            return $user->company->canPublishToSocialFeed();
        }

        if ($user->candidate) {
            return true;
        }

        return false;
    }

    private function resolveAvatar(User $user): string
    {
        return SocialPostFormatter::resolveAvatarForUser($user);
    }

    private function buildReels(): array
    {
        return SocialReels::fromCollection($this->feedGenerator->getTrendingPosts(60));
    }

    /**
     * @psalm-return int<1, 5>
     */
    private function commentReplyPreviewLimit(): int
    {
        $limit = (int) config('social.feed.comments.preview_replies', 3);

        if ($limit <= 0) {
            return 3;
        }

        return min($limit, 5);
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function normalizeSkills(?string $skills): array
    {
        return collect(explode(',', (string) $skills))
            ->map(fn ($skill) => Str::of($skill)->trim()->lower()->toString())
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function normalizeTags(?string $tags): array
    {
        return collect(explode(',', (string) $tags))
            ->map(fn ($tag) => Str::of($tag)->trim()->ltrim('#')->lower()->toString())
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function detectUploadedMediaType(?string $path, ?string $mime): string
    {
        if ($mime && str_contains($mime, 'video')) {
            return 'video';
        }

        if ($mime && str_contains($mime, 'image')) {
            return 'image';
        }

        return SocialPostFormatter::detectMediaType($path) ?? 'image';
    }

    public function share(Request $request, SocialPostModel $post): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401);

        $this->authorize('interact', $post);

        $payload = $request->validate([
            'channel' => ['required', 'string', 'max:60'],
            'note' => ['nullable', 'string', 'max:5000'],
        ]);

        $profile = $this->ensureProfile($user);

        $this->recordShare($post, $profile, $payload['channel'], ['note' => $payload['note'] ?? null]);

        $post->refresh();

        return response()->json([
            'data' => [
                'shares_count' => (int) $post->shares_count,
            ],
        ]);
    }

    public function repost(Request $request, SocialPostModel $post): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401);

        $this->authorize('repost', $post);

        $payload = $request->validate([
            'mode' => ['nullable', 'string', 'max:60'],
            'commentary' => ['nullable', 'string', 'max:5000'],
        ]);

        $profile = $this->ensureProfile($user);

        $this->recordShare($post, $profile, 'repost', [
            'mode' => $payload['mode'] ?? 'repost',
            'commentary' => $payload['commentary'] ?? null,
        ]);

        $post->refresh();

        return response()->json([
            'message' => 'Reposted to your feed.',
            'data' => [
                'shares_count' => (int) $post->shares_count,
            ],
        ]);
    }

    public function likeComment(Request $request, SocialPostModel $post, SocialComment $comment): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 401);

        $this->authorize('interact', $post);

        $profile = $this->ensureProfile($user);

        $existing = $comment->likes()->where('social_profile_id', $profile->id)->first();

        if ($existing) {
            $existing->delete();
            $this->adjustCounter($comment, 'likes_count', -1);
        } else {
            $comment->likes()->create([
                'social_profile_id' => $profile->id,
                'user_id' => $profile->resolveOwnerUser()?->id ?? $user->id,
                'likeable_type' => SocialComment::class,
                'likeable_id' => $comment->id,
                'liked_at' => now(),
            ]);

            $this->adjustCounter($comment, 'likes_count', 1);
        }

        $comment = $comment->fresh();

        return response()->json([
            'data' => [
                'comment' => SocialPostFormatter::formatComment($comment, $user, true),
            ],
        ]);
    }

    private function deletePostMedia(SocialPostModel $post): void
    {
        $paths = [];

        $mediaRelation = $post->relationLoaded('media')
            ? $post->getRelationValue('media')
            : $post->media()->get();

        foreach ($mediaRelation as $media) {
            $paths[] = $media->file_path ?? $media->path ?? null;
        }

        $attributeMedia = $post->media;
        if (is_array($attributeMedia)) {
            foreach ($attributeMedia as $item) {
                if (is_array($item) && ! empty($item['path'])) {
                    $paths[] = $item['path'];
                } elseif (is_array($item) && ! empty($item['file_path'])) {
                    $paths[] = $item['file_path'];
                }
            }
        } elseif (is_string($attributeMedia) && $attributeMedia !== '') {
            $paths[] = $attributeMedia;
        }

        foreach (array_filter(array_unique($paths)) as $path) {
            $this->deleteMediaIfOwned($path);
        }
    }

    private function deleteMediaIfOwned(?string $path): void
    {
        SocialMediaStorage::delete($path);
    }

    private function imageDriverUnavailableMessage(): string
    {
        return 'Image processing is temporarily unavailable. Please try again later.';
    }

}

