<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $movement_level
 * @property bool $pref_yoga
 * @property bool $pref_running
 * @property bool $pref_strength
 * @property bool $pref_team_sport
 * @property bool $pref_outdoors
 * @property bool $pref_meditation
 * @property bool $pref_vipassana
 * @property bool $pref_body_positive
 * @property bool $pref_adaptive
 * @property bool $pref_dv_safe
 * @property bool $pref_prenatal_postnatal
 * @property string|null $goals
 * @property string|null $constraints
 * @property string|null $health_topics
 * @property string|null $availability
 * @property string|null $energy_pattern
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereAvailability($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereConstraints($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereEnergyPattern($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereGoals($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereHealthTopics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereMovementLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefAdaptive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefBodyPositive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefDvSafe($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefMeditation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefOutdoors($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefPrenatalPostnatal($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefRunning($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefStrength($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefTeamSport($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefVipassana($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile wherePrefYoga($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WellbeingProfile whereUserId($value)
 * @mixin \Eloquent
 */
final class WellbeingProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'movement_level',
        'pref_yoga',
        'pref_running',
        'pref_strength',
        'pref_team_sport',
        'pref_outdoors',
        'pref_meditation',
        'pref_vipassana',
        'pref_body_positive',
        'pref_adaptive',
        'pref_dv_safe',
        'pref_prenatal_postnatal',
        'goals',
        'constraints',
        'health_topics',
        'availability',
        'energy_pattern',
    ];

    protected $casts = [
        'pref_yoga' => 'boolean',
        'pref_running' => 'boolean',
        'pref_strength' => 'boolean',
        'pref_team_sport' => 'boolean',
        'pref_outdoors' => 'boolean',
        'pref_meditation' => 'boolean',
        'pref_vipassana' => 'boolean',
        'pref_body_positive' => 'boolean',
        'pref_adaptive' => 'boolean',
        'pref_dv_safe' => 'boolean',
        'pref_prenatal_postnatal' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     *
     * Derive wellness tags that can be merged into the parent user interests.
     *
     * @return string[]
     *
     * @psalm-return array<int, 'wellness'>
     */
    public function preferredTags(): array
    {
        $tags = collect(['wellness']);

        $mapping = [
            'pref_yoga' => 'wellness:yoga',
            'pref_running' => 'wellness:run-club',
            'pref_strength' => 'wellness:strength',
            'pref_team_sport' => 'wellness:team',
            'pref_outdoors' => 'wellness:outdoors',
            'pref_meditation' => 'wellness:meditation',
            'pref_vipassana' => 'wellness:vipassana',
            'pref_body_positive' => 'wellness:body-positive',
            'pref_adaptive' => 'wellness:adaptive',
            'pref_dv_safe' => 'wellness:dv-safe',
            'pref_prenatal_postnatal' => 'wellness:maternal',
        ];

        foreach ($mapping as $attribute => $tag) {
            if ($this->getAttribute($attribute)) {
                $tags->push($tag);
            }
        }

        if ($this->movement_level) {
            $tags->push('wellness:movement:' . $this->movement_level);
        }

        return $tags->unique()->values()->all();
    }
}

