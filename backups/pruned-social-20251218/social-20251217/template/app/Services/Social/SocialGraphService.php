<?php

namespace App\Services\Social;

use App\Models\Invite;
use App\Services\Social\InviteDispatchService;
use App\Models\SocialGraphContact;
use App\Models\User;
use App\Support\ActiveProfile;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class SocialGraphService
{
    private InviteDispatchService $invites;

    public function __construct(?InviteDispatchService $invites = null)
    {
        $this->invites = $invites ?? app(InviteDispatchService::class);
    }


    /**
     * @param array<int, array<string, mixed>>  $contacts
     *
     * @return int[]
     *
     * @psalm-return array{created: int<0, max>, updated: int<0, max>, skipped: int<0, max>}
     */
    public function importContacts(User $owner, array $contacts, string $source, ?array $defaultConsent = null): array
    {
        if (empty($contacts)) {
            return ['created' => 0, 'updated' => 0, 'skipped' => 0];
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $now = CarbonImmutable::now();

        DB::transaction(function () use ($owner, $contacts, $source, $defaultConsent, &$created, &$updated, &$skipped, $now) {
            foreach ($contacts as $contact) {
                $normalized = $this->normalizeContactPayload($contact, $defaultConsent);
                $hash = $this->fingerprint($owner->getKey(), $normalized);

                if (! $hash) {
                    $skipped++;
                    continue;
                }

                $attributes = [
                    'user_id' => $owner->getKey(),
                    'contact_hash' => $hash,
                ];

                $values = array_filter([
                    'full_name' => $normalized['full_name'] ?? null,
                    'given_name' => $normalized['given_name'] ?? null,
                    'family_name' => $normalized['family_name'] ?? null,
                    'email' => $normalized['email'] ?? null,
                    'phone' => $normalized['phone'] ?? null,
                    'normalized_email' => $normalized['normalized_email'] ?? null,
                    'normalized_phone' => $normalized['normalized_phone'] ?? null,
                    'source' => $source,
                    'tags' => $normalized['tags'] ?? null,
                    'context' => $normalized['context'] ?? null,
                    'metadata' => $normalized['metadata'] ?? null,
                    'relationship_strength' => $normalized['relationship_strength'] ?? 50,
                    'last_interacted_at' => $normalized['last_interacted_at'] ?? $now,
                    'consent_granted_at' => $normalized['consent']['granted_at'] ?? null,
                    'consent_method' => $normalized['consent']['method'] ?? null,
                    'consent_scope' => $normalized['consent']['scope'] ?? null,
                    'consent_reference' => $normalized['consent']['reference'] ?? null,
                ], fn ($value) => $value !== null && $value !== '');

                $existing = SocialGraphContact::query()
                    ->where($attributes)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    $existing->fill($values);
                    $existing->save();
                    $updated++;
                } else {
                    SocialGraphContact::create($attributes + $values);
                    $created++;
                }
            }
        });

        return compact('created', 'updated', 'skipped');
    }

    /**
     * @psalm-return Collection<int, array{id: mixed, name: null|string, email: null|string, phone: null|string, source: string, tags: array, context: array, relationship_strength: int, last_invited_at: null|string}>|\Illuminate\Database\Eloquent\Collection<int, array{id: mixed, name: null|string, email: null|string, phone: null|string, source: string, tags: array, context: array, relationship_strength: int, last_invited_at: null|string}>
     */
    public function recommendations(User $user, int $limit = 12): Collection|\Illuminate\Database\Eloquent\Collection
    {
        $limit = max(1, min(40, $limit));

        $contacts = SocialGraphContact::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('relationship_strength')
            ->orderBy('full_name')
            ->limit($limit * 2)
            ->get();

        $recentInviteContactIds = Invite::query()
            ->where('sender_id', $user->getKey())
            ->whereNotNull('graph_contact_id')
            ->where('created_at', '>=', CarbonImmutable::now()->subDays(7))
            ->pluck('graph_contact_id')
            ->filter()
            ->unique()
            ->values();

        return $contacts
            ->reject(function (SocialGraphContact $contact) use ($recentInviteContactIds) {
                if (! $contact->hasReachableChannel()) {
                    return true;
                }

                if ($recentInviteContactIds->contains($contact->getKey())) {
                    return true;
                }

                return false;
            })
            ->take($limit)
            ->values()
            ->map(function (SocialGraphContact $contact) {
                return [
                    'id' => $contact->getKey(),
                    'name' => $contact->displayName(),
                    'email' => $contact->email,
                    'phone' => $contact->phone,
                    'source' => $contact->source,
                    'tags' => $contact->tags ?? [],
                    'context' => $contact->context ?? [],
                    'relationship_strength' => $contact->relationship_strength,
                    'last_invited_at' => optional($contact->last_invited_at)?->toIso8601String(),
                ];
            });
    }

    public function sendInviteForContact(User $user, SocialGraphContact $contact, array $options = []): Invite|null
    {
        if ($contact->user_id !== $user->getKey()) {
            throw new InvalidArgumentException('You can only invite contacts that belong to you.');
        }

        if (! $contact->hasReachableChannel()) {
            throw new InvalidArgumentException('This contact does not have a reachable email or phone.');
        }

        $profile = ActiveProfile::forUser($user);

        if (! $profile) {
            throw new InvalidArgumentException('You need an active persona profile to send invites.');
        }

        $recipient = array_filter([
            'email' => $contact->email,
            'phone' => $contact->phone,
            'note' => $options['note'] ?? null,
            'context' => $options['context'] ?? Arr::get($contact->context, 'summary'),
            'type' => 'social_graph',
            'graph_contact_id' => $contact->getKey(),
            'consent_snapshot' => $this->consentSnapshot($contact),
        ], fn ($value) => $value !== null && $value !== '');

        $result = $this->invites->send($user, $profile, [$recipient], [
            'message' => $options['message'] ?? null,
            'channel' => $options['channel'] ?? null,
            'tags' => $options['tags'] ?? ($contact->tags ?? []),
        ]);

        $invite = $result['invites']->first();

        if (! $invite) {
            throw new InvalidArgumentException('Unable to dispatch invite for this contact.');
        }

        $contact->forceFill(['last_invited_at' => CarbonImmutable::now()])->save();

        return $invite->fresh();
    }

    /**
     * @return ((mixed|string)[]|\ArrayAccess|mixed|string)[]
     *
     * @psalm-return array<string, \ArrayAccess|array<mixed|string>|mixed|string>
     */
    private function normalizeContactPayload(array $contact, ?array $defaultConsent = null): array
    {
        $fullName = Arr::get($contact, 'full_name') ?? Arr::get($contact, 'name');
        $given = Arr::get($contact, 'given_name');
        $family = Arr::get($contact, 'family_name');
        $email = Arr::get($contact, 'email');
        $phone = Arr::get($contact, 'phone');

        $normalizedEmail = $email ? strtolower(trim($email)) : null;
        $normalizedPhone = $phone ? preg_replace('/[^0-9+]/', '', $phone) : null;

        $consent = Arr::get($contact, 'consent') ?: $defaultConsent;
        if ($consent && isset($consent['granted_at'])) {
            $consent['granted_at'] = CarbonImmutable::parse($consent['granted_at']);
        }

        return array_filter([
            'full_name' => $fullName,
            'given_name' => $given,
            'family_name' => $family,
            'email' => $email,
            'phone' => $phone,
            'normalized_email' => $normalizedEmail,
            'normalized_phone' => $normalizedPhone,
            'tags' => Arr::get($contact, 'tags'),
            'context' => Arr::get($contact, 'context'),
            'metadata' => Arr::get($contact, 'metadata'),
            'relationship_strength' => Arr::get($contact, 'relationship_strength'),
            'last_interacted_at' => Arr::get($contact, 'last_interacted_at'),
            'consent' => $consent,
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function fingerprint(int $userId, array $contact): string|null
    {
        $primary = $contact['normalized_email'] ?? $contact['normalized_phone'] ?? null;

        if (! $primary) {
            return null;
        }

        return hash('sha256', $userId.'|'.$primary);
    }

    /**
     * @return null|string[]
     *
     * @psalm-return array<string, string>|null
     */
    private function consentSnapshot(SocialGraphContact $contact): array|null
    {
        if (! $contact->consent_granted_at && ! $contact->consent_method) {
            return null;
        }

        return array_filter([
            'granted_at' => optional($contact->consent_granted_at)?->toIso8601String(),
            'method' => $contact->consent_method,
            'scope' => $contact->consent_scope,
            'reference' => $contact->consent_reference,
        ], fn ($value) => $value !== null && $value !== '');
    }
}

