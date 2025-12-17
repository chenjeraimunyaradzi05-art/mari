<?php

namespace App\Services\Social;

use App\Jobs\Social\ContactSyncIngestJob;
use App\Models\ContactSyncContact;
use App\Models\ContactSyncSession;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class ContactSyncService
{
    private SocialGraphService $graph;

    public function __construct(?SocialGraphService $graph = null)
    {
        $this->graph = $graph ?? app(SocialGraphService::class);
    }


    public function start(User $user, string $provider): ContactSyncSession
    {
        $this->assertSessionThrottle($user);

        $providers = array_keys(config('social_invites.contact_sync.providers', []));
        if (! in_array($provider, $providers, true)) {
            throw new InvalidArgumentException('Unsupported contact provider.');
        }

        return DB::transaction(function () use ($user, $provider) {
            return ContactSyncSession::create([
                'user_id' => $user->getKey(),
                'provider' => $provider,
                'status' => 'pending',
                'state_token' => Str::uuid()->toString(),
                'auth_url' => $this->buildAuthUrl($provider),
                'metadata' => ['scopes' => $this->providerScopes($provider)],
            ]);
        });
    }

    /**
     * @param array<int, array<string, mixed>>  $contacts
     */
    public function handleCallback(ContactSyncSession $session, array $contacts): ContactSyncSession|null
    {
        $session->loadMissing('user');

        $session->forceFill([
            'status' => 'processing',
            'started_at' => CarbonImmutable::now(),
        ])->save();

        ContactSyncIngestJob::dispatch($session->getKey(), $contacts);

        if ($session->user) {
            $graphContacts = $this->prepareGraphContacts($contacts, $session->provider);

            if (! empty($graphContacts)) {
                $this->graph->importContacts(
                    $session->user,
                    $graphContacts,
                    $this->graphSourceForProvider($session->provider)
                );
            }
        }

        return $session->fresh();
    }

    /**
     * @psalm-return Collection<int, array{user: array{id: mixed|null, name: null|string, persona: null|string, display_name: null|string, avatar: null|string}, channel: string, metadata: array|null}>|\Illuminate\Database\Eloquent\Collection<int, array{user: array{id: mixed|null, name: null|string, persona: null|string, display_name: null|string, avatar: null|string}, channel: string, metadata: array|null}>
     */
    public function suggestions(User $user, int $limit = 20): Collection|\Illuminate\Database\Eloquent\Collection
    {
        $contacts = ContactSyncContact::query()
            ->where('user_id', $user->getKey())
            ->whereNotNull('matched_user_id')
            ->with(['matchedUser.activeProfile'])
            ->latest('updated_at')
            ->limit($limit * 2)
            ->get();

        return $contacts
            ->filter(function (ContactSyncContact $contact) {
                $profile = $contact->matchedUser?->activeProfile;
                if (! $profile) {
                    return false;
                }

                return $profile->privacy_level !== 'private';
            })
            ->take($limit)
            ->values()
            ->map(function (ContactSyncContact $contact) {
                $profile = $contact->matchedUser?->activeProfile;

                return [
                    'user' => [
                        'id' => $contact->matchedUser?->getKey(),
                        'name' => $contact->matchedUser?->name,
                        'persona' => $profile?->persona_type,
                        'display_name' => $profile?->display_name,
                        'avatar' => $profile?->avatar_path,
                    ],
                    'channel' => $contact->type,
                    'metadata' => $contact->metadata,
                ];
            });
    }

    protected function assertSessionThrottle(User $user): void
    {
        $perDay = (int) config('social_invites.throttle.contact_sync_per_day', 4);

        $count = ContactSyncSession::query()
            ->where('user_id', $user->getKey())
            ->whereDate('created_at', now()->toDateString())
            ->count();

        if ($count >= $perDay) {
            throw new InvalidArgumentException('Daily contact sync limit reached.');
        }
    }

    protected function buildAuthUrl(string $provider): string
    {
        $base = match ($provider) {
            'google' => 'https://accounts.google.com/o/oauth2/v2/auth',
            'outlook' => 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            default => 'https://example.com/oauth',
        };

        return $base.'?state='.Str::uuid()->toString();
    }

    protected function providerScopes(string $provider): array
    {
        $providers = config('social_invites.contact_sync.providers', []);

        return $providers[$provider]['scopes'] ?? [];
    }

    /**
     * @param array<int, array<string, mixed>>  $contacts
     *
     * @return ((CarbonImmutable|int|mixed|string|string[])[]|null)[]
     *
     * @psalm-return array<int, array<string, 60|CarbonImmutable|array{0?: 'contact_sync', provider?: string, ingested_via?: 'contact_sync_callback'}|mixed|string>|null>
     */
    protected function prepareGraphContacts(array $contacts, string $provider): array
    {
        $now = CarbonImmutable::now();

        return collect($contacts)
            ->map(function (array $contact) use ($provider, $now) {
                $email = strtolower(trim((string) Arr::get($contact, 'email', '')));
                $phone = Arr::get($contact, 'phone');

                if ($email === '' && empty($phone)) {
                    return null;
                }

                return array_filter([
                    'full_name' => Arr::get($contact, 'name'),
                    'email' => $email !== '' ? $email : null,
                    'phone' => $phone,
                    'context' => array_filter([
                        'provider' => $provider,
                        'ingested_via' => 'contact_sync_callback',
                    ]),
                    'tags' => ['contact_sync'],
                    'relationship_strength' => 60,
                    'last_interacted_at' => $now,
                ], fn ($value) => $value !== null && $value !== '');
            })
            ->filter()
            ->values()
            ->all();
    }

    protected function graphSourceForProvider(string $provider): string
    {
        return 'contact_sync:'.Str::slug($provider ?: 'custom', '-');
    }
}

