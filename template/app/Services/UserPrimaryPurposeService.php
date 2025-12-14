<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserPrimaryPurpose;
use Illuminate\Support\Arr;

final class UserPrimaryPurposeService
{
    /**
     * Persist the canonical primary purpose payload for a user and sync key user columns.
     */
    public function upsert(User $user, array $payload, bool $forceCompletion = true): UserPrimaryPurpose
    {
        $primaryPurpose = $payload['primary_purpose'];
        $secondaryIntents = collect($payload['secondary_intents'] ?? [])
            ->filter()
            ->unique()
            ->values()
            ->all();
        $identityAlignment = $payload['identity_alignment'] ?? 'woman_identifying';
        $purposeStory = Arr::get($payload, 'purpose_story');
        $maleSignalNotes = Arr::get($payload, 'male_signal_notes');

        $featureFlags = config("signup.primary_purposes.{$primaryPurpose}.feature_flags", []);
        $role = config("signup.primary_purposes.{$primaryPurpose}.role", 'candidate') === 'company'
            ? 'company'
            : 'candidate';

        $attributes = [
            'primary_purpose' => $primaryPurpose,
            'secondary_intents' => $secondaryIntents,
            'feature_flags' => $featureFlags,
            'identity_alignment' => $identityAlignment,
            'purpose_story' => $purposeStory ?: null,
            'male_signal_notes' => $maleSignalNotes ?: null,
            'completion_step' => 2,
        ];

        if ($forceCompletion || ! optional($user->primaryPurposeProfile)->completed_at) {
            $attributes['completed_at'] = now();
        }

        $record = UserPrimaryPurpose::query()->updateOrCreate(
            ['user_id' => $user->id],
            $attributes
        );

        $user->forceFill([
            'account_classification' => $primaryPurpose,
            'role' => $role,
            'user_intentions' => $this->mergeIntentions($user, $primaryPurpose, $secondaryIntents),
        ])->save();

        return $record;
    }

    /**
     * @return (array|mixed|string)[]
     *
     * @psalm-return array{primary_purpose: string, secondary_intents: array,...}
     */
    private function mergeIntentions(User $user, string $primaryPurpose, array $secondaryIntents): array
    {
        $existing = $user->user_intentions ?? [];

        return array_merge($existing, [
            'primary_purpose' => $primaryPurpose,
            'secondary_intents' => $secondaryIntents,
        ]);
    }
}

