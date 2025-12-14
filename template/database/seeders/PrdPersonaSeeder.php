<?php

namespace Database\Seeders;

use App\Models\Candidate;
use App\Models\Company;
use App\Models\Course;
use App\Models\OrganizationPage;
use App\Models\SocialFollow;
use App\Models\SocialMedia;
use App\Models\SocialPost;
use App\Models\SocialProfile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class PrdPersonaSeeder extends Seeder
{
    public function run(): void
    {
        // Production persona seeding is heavy; only perform the full import
        // automatically in test environments where the fixtures are relied
        // on by our feature tests. For other environments keep the no-op.
        if (! app()->environment('testing')) {
            return;
        }

        $dataFile = __DIR__ . '/data/prd_personas.php';
        if (! file_exists($dataFile)) {
            return;
        }

        $seedData = include $dataFile;

        // Seed candidate personas
        foreach ($seedData['candidates'] ?? [] as $persona) {
            $profile = $this->seedCandidatePersona($persona);
            $this->indexProfile($profile);
        }

        // Seed trainee personas (treated as candidates)
        foreach ($seedData['trainees'] ?? [] as $persona) {
            $profile = $this->seedCandidatePersona($persona);
            $this->indexProfile($profile);
        }

        // Seed organisations
        foreach ($seedData['organizations'] ?? [] as $persona) {
            $profile = $this->seedOrganizationPersona($persona);
            $this->indexProfile($profile);
        }

        // Starter demo
        if (! empty($seedData['starter_demo'])) {
            $demo = $this->seedStarterDemo($seedData['starter_demo']);
            $this->indexProfile($demo);
        }

        // Create follows queued up while seeding
        $this->syncQueuedFollows();
    }
    /** @var array<string, mixed> */
    private array $assetLibrary = [];

    /** @var array<string, \App\Models\SocialProfile> */
    private array $profileIndex = [];

    /** @var array<string, array<int, string>> */
    private array $pendingFollowMap = [];

    private function seedCandidatePersona(array $persona): SocialProfile
    {
        $username = $this->normaliseHandle($persona['username'] ?? Str::slug($persona['full_name'] ?? Str::random(5)));
        $user = User::query()->updateOrCreate(
            ['email' => $persona['email']],
            [
                'name' => $persona['full_name'],
                'password' => Hash::make('password'),
                'role' => 'member',
                'account_classification' => 'member',
                'email_verified_at' => now(),
            ]
        );

        $candidate = Candidate::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'full_name' => $persona['full_name'],
                'email' => $persona['email'],
                'title' => $persona['headline'] ?? null,
                'bio' => $persona['bio'] ?? null,
                'status' => $persona['status'] ?? 'available',
                'address' => $persona['location'] ?? null,
            ]
        );

        $profile = SocialProfile::query()->updateOrCreate(
            [
                'profileable_type' => Candidate::class,
                'profileable_id' => $candidate->id,
            ],
            [
                'user_id' => $user->id,
                'username' => $username,
                'display_name' => $persona['display_name'] ?? $persona['full_name'],
                'bio' => $persona['bio'] ?? null,
                'website' => Arr::get($persona, 'links.website'),
                'social_links' => array_filter($persona['links'] ?? []),
                'profile_type' => $persona['profile_type'] ?? 'candidate',
                'is_verified' => Arr::get($persona, 'verified', true),
                'is_private' => false,
            ]
        );

        $this->seedPostsForProfile($profile, $persona['posts'] ?? [], $persona['key'] ?? $username);
        $this->queueFollowSync($profile, $persona);

        return $profile->refresh();
    }

    private function seedOrganizationPersona(array $persona): SocialProfile
    {
        $username = $this->normaliseHandle($persona['username'] ?? Str::slug($persona['name']));
        $email = $persona['contact_email'] ?? $username.'@example.test';

        $user = User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $persona['name'].' Team',
                'password' => Hash::make('password'),
                'role' => 'company',
                'account_classification' => 'company',
                'email_verified_at' => now(),
            ]
        );

        $company = Company::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'name' => $persona['name'],
                'slug' => Str::slug($persona['name']),
                'bio' => $persona['about'] ?? null,
                'vision' => $persona['mission'] ?? null,
                'website' => $persona['website'] ?? null,
                'email' => $email,
            ]
        );

            $pageSlug = Str::slug($persona['name']);
            $page = OrganizationPage::query()->firstOrNew([
                'company_id' => $company->id,
                'slug' => $pageSlug,
            ]);

            $page->fill([
                'type' => $persona['type'] ?? 'employer',
                'name' => $persona['name'],
                'tagline' => $persona['tagline'] ?? null,
                'about' => $persona['about'] ?? null,
                'mission' => $persona['mission'] ?? null,
                'highlights' => $persona['highlights'] ?? [],
                'policies' => $persona['policies'] ?? [],
                'hero_cta_label' => Arr::get($persona, 'cta.label'),
                'hero_cta_url' => Arr::get($persona, 'cta.url'),
                'website_url' => $persona['website'] ?? null,
                'contact_email' => $email,
                'contact_phone' => $persona['contact_phone'] ?? null,
            ]);

            if (! $page->exists) {
                $page->slug = $pageSlug;
            }

            if (! $page->profile_status) {
                $page->profile_status = 'published';
            }

            if (! $page->published_at) {
                $page->published_at = now();
            }

            $page->save();

        foreach ($persona['courses'] ?? [] as $course) {
            Course::query()->updateOrCreate(
                [
                    'provider_org_page_id' => $page->getKey(),
                    'code' => $course['code'],
                ],
                [
                    'title' => $course['title'],
                    'summary' => $course['summary'] ?? null,
                    'type' => $this->resolveCourseType($course['type'] ?? null),
                    'mode' => $this->resolveCourseMode($course['mode'] ?? null),
                    'location' => $course['location'] ?? null,
                    'delivery_options' => $course['delivery_options'] ?? [],
                    'duration_weeks' => $course['duration_weeks'] ?? null,
                    'funding' => $course['funding'] ?? [],
                    'prerequisites' => $course['prerequisites'] ?? [],
                    'outcomes' => $course['outcomes'] ?? [],
                    'tags' => $course['tags'] ?? [],
                    'application_url' => $course['application_url'] ?? null,
                    'status' => 'published',
                ]
            );
        }

        $profile = SocialProfile::query()->updateOrCreate(
            [
                'profileable_type' => OrganizationPage::class,
                'profileable_id' => $page->id,
            ],
            [
                'user_id' => $user->id,
                'username' => $username,
                'display_name' => $persona['name'],
                'bio' => $persona['tagline'] ?? null,
                'website' => $persona['website'] ?? null,
                'social_links' => array_filter([
                    'website' => $persona['website'] ?? null,
                    'linkedin' => $persona['linkedin'] ?? null,
                    'instagram' => $persona['instagram'] ?? null,
                ]),
                'profile_type' => $persona['profile_type'] ?? 'company',
                'is_verified' => true,
                'is_private' => false,
            ]
        );

        $this->seedPostsForProfile($profile, $persona['posts'] ?? [], $persona['key'] ?? $username);
        $this->queueFollowSync($profile, $persona);

        return $profile->refresh();
    }

    private function seedStarterDemo(array $persona): SocialProfile
    {
        return $this->seedCandidatePersona($persona);
    }

    private function seedPostsForProfile(SocialProfile $profile, array $posts, string $personaKey): void
    {
        foreach ($posts as $blueprint) {
            $seedKey = $blueprint['seed_key'] ?? Str::uuid()->toString();
            $asset = $this->buildMediaPayload($blueprint['asset_key'] ?? null);
            $meta = array_merge($asset['meta'], [
                'seed_key' => $seedKey,
                'persona_key' => $personaKey,
                'source' => 'prd-persona-seeder',
            ]);

            $post = SocialPost::query()
                ->where('social_profile_id', $profile->id)
                ->where('meta->seed_key', $seedKey)
                ->first();

            $attributes = [
                'social_profile_id' => $profile->id,
                'user_id' => $profile->user_id,
                'postable_type' => SocialProfile::class,
                'postable_id' => $profile->id,
                'type' => $blueprint['type'] ?? 'feed',
                'post_type' => $blueprint['post_type'] ?? 'post',
                'content' => $blueprint['content'] ?? null,
                'caption' => $blueprint['caption'] ?? null,
                'media' => $asset['media_payload'],
                'tags' => $blueprint['tags'] ?? [],
                'ai_tags' => $blueprint['ai_tags'] ?? [],
                'visibility' => $blueprint['visibility'] ?? 'public',
                'moderation_status' => $blueprint['moderation_status'] ?? 'approved',
                'likes_count' => $blueprint['likes_count'] ?? rand(24, 320),
                'comments_count' => $blueprint['comments_count'] ?? rand(3, 40),
                'shares_count' => $blueprint['shares_count'] ?? rand(1, 25),
                'views_count' => $blueprint['views_count'] ?? rand(200, 2500),
                'is_sponsored' => $blueprint['is_sponsored'] ?? false,
                'ai_engagement_score' => $blueprint['ai_engagement_score'] ?? 0.6,
                'published_at' => Carbon::now()->subDays($blueprint['published_days_ago'] ?? rand(1, 10)),
                'meta' => $meta,
            ];

            if ($post) {
                $post->fill($attributes);
            } else {
                $post = new SocialPost($attributes);
            }

            $post->save();

            if ($asset['media_model']) {
                SocialMedia::query()
                    ->where('social_post_id', $post->id)
                    ->where('ai_analysis->seed_key', $seedKey)
                    ->delete();

                SocialMedia::query()->create(array_merge($asset['media_model'], [
                    'social_post_id' => $post->id,
                    'ai_analysis' => array_merge($asset['media_model']['ai_analysis'], [
                        'seed_key' => $seedKey,
                        'persona_key' => $personaKey,
                    ]),
                ]));
            }
        }
    }

    /**
     * @return (((mixed|null|string)[]|mixed|null|string|true)[]|null)[]
     *
     * @psalm-return array{media_payload: list{0?: array{path: mixed, thumbnail: mixed|null, type: mixed, alt: mixed|null}}, media_model: array{media_type: mixed, file_path: mixed, thumbnail_path: mixed|null, mime_type: 'image/jpeg'|mixed, ai_analysis: array{asset_key: null|string, asset_source: 'laravel-social-starter'|mixed}}|null, meta: array{asset_key?: null|string, asset_description?: mixed|null, asset_source?: 'laravel-social-starter'|mixed, asset_missing?: true}}
     */
    private function buildMediaPayload(?string $assetKey): array
    {
        $asset = $assetKey ? Arr::get($this->assetLibrary, 'media.'.$assetKey) : null;

        if (! $asset) {
            return [
                'media_payload' => [],
                'media_model' => null,
                'meta' => $assetKey ? ['asset_key' => $assetKey, 'asset_missing' => true] : [],
            ];
        }

        $payload = [[
            'path' => $asset['url'],
            'thumbnail' => $asset['thumbnail'] ?? null,
            'type' => $asset['type'],
            'alt' => $asset['description'] ?? null,
        ]];

        return [
            'media_payload' => $payload,
            'media_model' => [
                'media_type' => $asset['type'],
                'file_path' => $asset['url'],
                'thumbnail_path' => $asset['thumbnail'] ?? null,
                'mime_type' => $asset['mime'] ?? 'image/jpeg',
                'ai_analysis' => [
                    'asset_key' => $assetKey,
                    'asset_source' => $asset['source'] ?? 'laravel-social-starter',
                ],
            ],
            'meta' => [
                'asset_key' => $assetKey,
                'asset_description' => $asset['description'] ?? null,
                'asset_source' => $asset['source'] ?? 'laravel-social-starter',
            ],
        ];
    }

    private function queueFollowSync(SocialProfile $profile, array $persona): void
    {
        $follows = array_filter(array_map(function ($handle) {
            return $this->normaliseHandle($handle);
        }, $persona['follows'] ?? []));

        if (empty($follows)) {
            return;
        }

        $this->pendingFollowMap[$profile->username] = $follows;
    }

    private function syncQueuedFollows(): void
    {
        foreach ($this->pendingFollowMap as $username => $handles) {
            $follower = $this->profileIndex[$username] ?? null;

            if (! $follower) {
                continue;
            }

            foreach ($handles as $handle) {
                $target = $this->profileIndex[$handle] ?? null;

                if (! $target || $target->id === $follower->id) {
                    continue;
                }

                SocialFollow::query()->firstOrCreate(
                    [
                        'follower_id' => $follower->id,
                        'following_id' => $target->id,
                    ],
                    [
                        'is_close_friend' => false,
                        'notifications_enabled' => true,
                        'followed_at' => now()->subDays(rand(1, 14)),
                    ]
                );
            }
        }
    }

    private function indexProfile(SocialProfile $profile): SocialProfile
    {
        $this->profileIndex[$profile->username] = $profile;

        return $profile;
    }

    private function normaliseHandle(string $handle): string
    {
        return Str::slug(ltrim($handle, '@'), '.');
    }

    private function resolveCourseType(?string $type): string
    {
        return match (Str::lower((string) $type)) {
            'bachelor', 'degree' => 'bachelor',
            'masters', 'master', 'postgrad' => 'masters',
            'micro', 'micro_credential' => 'micro',
            'certificate', 'cert', 'tafe_cert' => 'tafe_cert',
            'diploma', 'tafe_diploma' => 'tafe_diploma',
            'apprenticeship' => 'apprenticeship',
            default => 'short',
        };
    }

    private function resolveCourseMode(?string $mode): string
    {
        return match (Str::lower((string) $mode)) {
            'campus', 'on_campus' => 'on_campus',
            'online' => 'online',
            default => 'hybrid',
        };
    }
}

