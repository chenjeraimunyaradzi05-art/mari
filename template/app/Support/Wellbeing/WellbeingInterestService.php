<?php

namespace App\Support\Wellbeing;

use App\Models\User;
use App\Models\WellbeingProfile;
use Illuminate\Support\Str;

class WellbeingInterestService
{
    private const PROFILE_PREFERENCE_KEYWORDS = [
        'pref_yoga' => 'yoga',
        'pref_running' => 'run',
        'pref_strength' => 'strength',
        'pref_team_sport' => 'team',
        'pref_outdoors' => 'outdoors',
        'pref_meditation' => 'meditation',
        'pref_vipassana' => 'vipassana',
    ];

    private const KEYWORD_TAG_MAP = [
        'yoga' => 'wellness:yoga',
        'pilates' => 'wellness:pilates',
        'mobility' => 'wellness:mobility',
        'mobility-flow' => 'wellness:mobility',
        'breathwork' => 'wellness:breathwork',
        'breathing' => 'wellness:breathwork',
        'run' => 'wellness:run-club',
        'running' => 'wellness:run-club',
        'run-club' => 'wellness:run-club',
        'cycle' => 'wellness:cycle',
        'cycling' => 'wellness:cycle',
        'bike' => 'wellness:cycle',
        'cardio' => 'wellness:cardio',
        'strength' => 'wellness:strength',
        'lifting' => 'wellness:strength',
        'weights' => 'wellness:strength',
        'team' => 'wellness:team',
        'outdoors' => 'wellness:outdoors',
        'trail' => 'wellness:trail',
        'hike' => 'wellness:trail',
        'hiking' => 'wellness:trail',
        'swim' => 'wellness:swim',
        'swimming' => 'wellness:swim',
        'surf' => 'wellness:surf',
        'surfing' => 'wellness:surf',
        'boxing' => 'wellness:boxing',
        'kickboxing' => 'wellness:boxing',
        'dance' => 'wellness:dance',
        'dancing' => 'wellness:dance',
        'meditation' => 'wellness:meditation',
        'mindfulness' => 'wellness:meditation',
        'vipassana' => 'wellness:vipassana',
        'prenatal' => 'wellness:prenatal',
        'antenatal' => 'wellness:prenatal',
        'postnatal' => 'wellness:postnatal',
        'postpartum' => 'wellness:postnatal',
        'pelvic-floor' => 'wellness:pelvic-floor',
        'pelvic_floor' => 'wellness:pelvic-floor',
        'pelvic' => 'wellness:pelvic-floor',
        'hormone' => 'wellness:hormone-health',
        'hormones' => 'wellness:hormone-health',
    ];

    private const USER_INTEREST_MAP = [
        'health' => ['wellness'],
        'wellness' => ['wellness'],
        'fitness' => ['wellness'],
    ];

    /**
     * @psalm-return array<int, mixed>
     */
    public function tagsFromProfile(?WellbeingProfile $profile): array
    {
        if (! $profile) {
            return ['wellness'];
        }

        $tags = collect($profile->preferredTags());

        if ($tags->doesntContain('wellness')) {
            $tags->prepend('wellness');
        }

        return $tags->unique()->values()->all();
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0?: 'wellness'}
     */
    public function inferFromUser(User $user): array
    {
        $tags = collect();

        $profile = $user->relationLoaded('activeProfile')
            ? $user->activeProfile
            : $user->activeProfile()->first();

        if ($profile && is_array($profile->health_interests)) {
            $tags = $tags->merge($this->mapHealthKeywordsToTags($profile->health_interests));
        }

        $interests = collect($user->interests ?? [])
            ->filter(fn ($interest) => is_string($interest));

        if ($interests->isEmpty()) {
            return $tags->isEmpty() ? ['wellness'] : $tags->unique()->values()->all();
        }

        $interests->each(function (string $interest) use (&$tags) {
            if (str_starts_with($interest, 'wellness')) {
                $tags->push($interest);
                return;
            }

            foreach ($this->mapUserInterestToken($interest) as $mapped) {
                $tags->push($mapped);
            }
        });

        if ($tags->isEmpty()) {
            $tags->push('wellness');
        }

        return $tags->unique()->values()->all();
    }

    public function syncUserInterests(User $user, array $tags): void
    {
        $existing = collect($user->interests ?? []);
        $merged = $existing->merge($tags)
            ->filter(fn ($interest) => is_string($interest) && trim($interest) !== '')
            ->unique()
            ->values()
            ->all();

        if ($merged !== $existing->values()->all()) {
            $user->forceFill(['interests' => $merged])->save();
        }
    }

    public function syncProfileHealthInterests(User $user, ?WellbeingProfile $profile = null): void
    {
        $activeProfile = $user->relationLoaded('activeProfile')
            ? $user->activeProfile
            : $user->activeProfile()->first();

        if (! $activeProfile) {
            return;
        }

        $keywords = $this->deriveProfileHealthKeywords($profile);

        $activeProfile->forceFill([
            'health_interests' => $keywords ?: null,
        ])->save();
    }

    public function preferredInterest(array $tags): ?string
    {
        $collection = collect($tags)
            ->filter(fn ($interest) => is_string($interest));

        if ($collection->isEmpty()) {
            return null;
        }

        return $collection->first(fn ($interest) => $interest !== 'wellness') ?? $collection->first();
    }

    /**
     * @psalm-return array<int, never>
     */
    private function deriveProfileHealthKeywords(?WellbeingProfile $profile): array
    {
        if (! $profile) {
            return [];
        }

        $keywords = collect();

        foreach (self::PROFILE_PREFERENCE_KEYWORDS as $attribute => $keyword) {
            if ($profile->getAttribute($attribute)) {
                $keywords->push($keyword);
            }
        }

        if ($profile->movement_level) {
            $keywords->push('movement:'.$profile->movement_level);
        }

        if ($profile->energy_pattern) {
            $keywords->push('energy:'.$profile->energy_pattern);
        }

        return $keywords->unique()->values()->all();
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<int, null|string>
     */
    private function mapHealthKeywordsToTags(array $keywords): array
    {
        return collect($keywords)
            ->filter(fn ($keyword) => is_string($keyword))
            ->map(fn (string $keyword) => $this->mapKeywordToTag($keyword))
            ->filter()
            ->values()
            ->all();
    }

    private function mapKeywordToTag(string $keyword): string|null
    {
        $normalized = Str::of($keyword)->lower()->value();

        return self::KEYWORD_TAG_MAP[$normalized] ?? null;
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0?: string}
     */
    private function mapUserInterestToken(string $interest): array
    {
        $normalized = Str::of($interest)->lower()->value();

        if (isset(self::USER_INTEREST_MAP[$normalized])) {
            return self::USER_INTEREST_MAP[$normalized];
        }

        if (isset(self::KEYWORD_TAG_MAP[$normalized])) {
            return [self::KEYWORD_TAG_MAP[$normalized]];
        }

        return [];
    }
}

