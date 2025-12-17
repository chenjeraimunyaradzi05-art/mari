<?php

namespace App\Jobs\Social;

use App\Models\User;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\Social\SocialGraphService;
use App\Support\ContactHasher;
use App\Support\InAppNotifier;
use Carbon\CarbonImmutable;
use App\Models\ContactSyncContact;
use App\Models\ContactSyncSession;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB as DBFacade;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ContactSyncIngestJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * @param  array<int, array<string, mixed>>  $contacts
     */
    public function __construct(private readonly int $sessionId, private readonly array $contacts)
    {
    }

    private function matchUser(string $type, string $value, int $ownerId): ?int
    {
        if ($type === 'email') {
            $candidate = User::query()
                ->where('email', strtolower(trim($value)))
                ->value('id');

            if ($candidate && $candidate !== $ownerId) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed>  $contact
     *
     * @return (mixed|string)[]
     *
     * @psalm-return array{last4?: string, country?: mixed, domain?: string, name?: mixed}
     */
    private function buildMetadata(string $type, string $value, array $contact): array
    {
        if ($type === 'email') {
            $parts = explode('@', $value);
            $domain = $parts[1] ?? null;

            return array_filter([
                'domain' => $domain,
                'name' => Arr::get($contact, 'name'),
            ]);
        }

        $digits = preg_replace('/[^0-9]/', '', $value);

        return array_filter([
            'last4' => substr($digits, -4) ?: null,
            'country' => Arr::get($contact, 'country'),
        ]);
    }

    /**
     * @return (CarbonImmutable|int|mixed|string|string[])[]|null
     *
     * @psalm-return array<string, 65|CarbonImmutable|array{0?: 'contact_sync', provider?: string, ingested_via?: 'contact_sync_job'}|mixed|string>|null
     */
    private function buildGraphPayload(array $contact, string $type, string $provider): array|null
    {
        $email = $type === 'email' ? strtolower(trim((string) Arr::get($contact, 'email', ''))) : null;
        $phone = $type === 'phone' ? Arr::get($contact, 'phone') : null;

        if (($email === null || $email === '') && empty($phone)) {
            return null;
        }

        return array_filter([
            'full_name' => Arr::get($contact, 'name'),
            'email' => $email !== '' ? $email : null,
            'phone' => $phone,
            'context' => array_filter([
                'provider' => $provider,
                'ingested_via' => 'contact_sync_job',
            ]),
            'tags' => ['contact_sync'],
            'relationship_strength' => 65,
            'last_interacted_at' => CarbonImmutable::now(),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function graphSourceForProvider(string $provider): string
    {
        return 'contact_sync:'.Str::slug($provider ?: 'custom', '-');
    }

    public function handle(): void
    {
        $session = ContactSyncSession::find($this->sessionId);
        if (! $session) {
            return;
        }

        // Ensure user is loaded
        $session->loadMissing('user');

        DBFacade::transaction(function () use ($session) {
            foreach ((array) $this->contacts as $contact) {
                // prefer email if present, otherwise phone
                $email = strtolower(trim((string) Arr::get($contact, 'email', '')));
                $phone = Arr::get($contact, 'phone');

                $type = $email !== '' ? 'email' : ($phone ? 'phone' : null);
                if (! $type) {
                    continue;
                }

                $value = $type === 'email' ? $email : $phone;

                $hash = hash('sha256', $session->getKey()."|".$value);

                $matchedUserId = null;
                if ($type === 'email' && $email !== '') {
                    $matchedUserId = $this->matchUser('email', $email, $session->user_id);
                }

                ContactSyncContact::updateOrCreate(
                    ['session_id' => $session->getKey(), 'hash' => $hash],
                    [
                        'user_id' => $session->user_id,
                        'hash' => $hash,
                        'type' => $type,
                        'matched_user_id' => $matchedUserId,
                        'metadata' => $this->buildMetadata($type, $value, $contact),
                        'expires_at' => now()->addDays(30),
                    ]
                );
            }

            $session->forceFill([
                'status' => 'active',
                'synced_contacts_count' => $session->contacts()->count(),
                'completed_at' => now(),
            ])->save();
        });
    }
}

