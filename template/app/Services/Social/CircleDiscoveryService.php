<?php

namespace App\Services\Social;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class CircleDiscoveryService
{
    /**
     * Discover users based on a list of contacts.
     *
     * @param array $contacts List of contacts with 'email' and/or 'phone'.
     *
     * @return (Collection|array)[] Result containing 'matches' (User objects) and 'invites' (unmatched contacts).
     *
     * @psalm-return array{matches: Collection<int, never>, invites: list<mixed>}
     */
    public function discoverFromContacts(array $contacts): array
    {
        $emails = collect($contacts)->pluck('email')->filter()->map(fn($e) => Str::lower($e))->unique();
        $phones = collect($contacts)->pluck('phone')->filter()->map(fn($p) => $this->normalizePhone($p))->unique();

        // Find matches by email
        $emailMatches = User::whereIn('email', $emails)->get()->keyBy('email');

        // Find matches by phone
        // Note: In a real scenario, phone matching might need more complex logic (country codes, etc.)
        // Here we assume exact match on normalized phone.
        $phoneMatches = User::whereIn('phone', $phones)->get()->keyBy('phone');

        $matches = new Collection();
        $invites = [];

        foreach ($contacts as $contact) {
            $matchedUser = null;

            // Check email match
            if (!empty($contact['email'])) {
                $normalizedEmail = Str::lower($contact['email']);
                if ($emailMatches->has($normalizedEmail)) {
                    $matchedUser = $emailMatches->get($normalizedEmail);
                }
            }

            // Check phone match if not already matched
            if (!$matchedUser && !empty($contact['phone'])) {
                $normalizedPhone = $this->normalizePhone($contact['phone']);
                if ($phoneMatches->has($normalizedPhone)) {
                    $matchedUser = $phoneMatches->get($normalizedPhone);
                }
            }

            if ($matchedUser) {
                // Avoid duplicates in the matches list
                if (!$matches->contains('id', $matchedUser->id)) {
                    $matches->push($matchedUser);
                }
            } else {
                $invites[] = $contact;
            }
        }

        return [
            'matches' => $matches->values(),
            'invites' => $invites,
        ];
    }

    /**
     * Normalize phone number for consistent matching.
     * This is a simplified version.
     *
     * @return null|string
     */
    private function normalizePhone(string $phone): string|null
    {
        // Remove non-numeric characters
        return preg_replace('/[^0-9]/', '', $phone);
    }
}

