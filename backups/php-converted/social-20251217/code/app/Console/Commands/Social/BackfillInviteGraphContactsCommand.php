<?php

namespace App\Console\Commands\Social;

use App\Models\Invite;
use App\Models\SocialGraphContact;
use App\Models\User;
use App\Services\Social\SocialGraphService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;

final class BackfillInviteGraphContactsCommand extends Command
{
    protected $signature = 'social-graph:backfill-invites {--chunk=250} {--dry-run}';

    protected $description = 'Backfill legacy invites into the social graph contacts table.';

    /**
     * @return ((mixed|string)[]|\Illuminate\Support\Carbon|int|mixed|string)[][]|null
     *
     * @psalm-return array{payload: array<string, 55|\Illuminate\Support\Carbon|array{invite_id?: mixed, channel?: string, type?: string, 0?: mixed,...}|mixed|string>, lookup: array{normalized_email?: string, normalized_phone?: string}}|null
     */
    protected function buildContactDefinition(Invite $invite): array|null
    {
        $email = $invite->recipient_email ? strtolower(trim($invite->recipient_email)) : null;
        $phone = $invite->recipient_phone ? preg_replace('/[^0-9+]/', '', $invite->recipient_phone) : null;

        if (! $email && ! $phone) {
            return null;
        }

        $tags = array_values(array_filter((array) data_get($invite->payload, 'tags', [])));
        $context = array_filter([
            'invite_id' => $invite->getKey(),
            'channel' => $invite->channel,
            'type' => $invite->type,
        ]);

        return [
            'payload' => array_filter([
                'full_name' => data_get($invite->payload, 'recipient.name'),
                'email' => $email,
                'phone' => $invite->recipient_phone,
                'tags' => empty($tags) ? null : $tags,
                'context' => $context,
                'relationship_strength' => 55,
                'last_interacted_at' => $invite->created_at,
            ], fn ($value) => $value !== null && $value !== ''),
            'lookup' => array_filter([
                'normalized_email' => $email,
                'normalized_phone' => $phone,
            ]),
        ];
    }

    protected function locateContact(int $userId, array $lookup): SocialGraphContact|null
    {
        if (empty($lookup)) {
            return null;
        }

        return SocialGraphContact::query()
            ->where('user_id', $userId)
            ->where(function ($query) use ($lookup) {
                if ($email = $lookup['normalized_email'] ?? null) {
                    $query->orWhere('normalized_email', $email);
                }

                if ($phone = $lookup['normalized_phone'] ?? null) {
                    $query->orWhere('normalized_phone', $phone);
                }
            })
            ->orderByDesc('updated_at')
            ->first();
    }

    /**
     * @return null|string[]
     *
     * @psalm-return array<string, string>|null
     */
    protected function consentSnapshotFromContact(SocialGraphContact $contact): array|null
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

