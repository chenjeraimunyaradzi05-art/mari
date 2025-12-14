<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $title
 * @property string $slug
 * @property string $description
 * @property string $type
 * @property string $category
 * @property array<array-key, mixed> $requirements
 * @property int $target_value
 * @property int $points_reward
 * @property int|null $badge_id
 * @property string $difficulty
 * @property \Illuminate\Support\Carbon|null $start_date
 * @property \Illuminate\Support\Carbon|null $end_date
 * @property bool $is_active
 * @property bool $is_repeatable
 * @property int $participants_count
 * @property int $completions_count
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Badge|null $badge
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateChallenge> $candidateChallenges
 * @property int|null candidate_challenges_count
 * @property-read float $completion_rate
 * @property-read string $difficulty_color
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge ofCategory($category)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge ofType($type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereBadgeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereCompletionsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereDifficulty($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereEndDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereIsRepeatable($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereParticipantsCount($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge wherePointsReward($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereRequirements($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereStartDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereTargetValue($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Challenge whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Challenge extends Model
{
    protected $fillable = [
        'title',
        'slug',
        'description',
        'type',
        'category',
        'requirements',
        'target_value',
        'points_reward',
        'badge_id',
        'difficulty',
        'start_date',
        'end_date',
        'is_active',
        'is_repeatable',
        'participants_count',
        'completions_count',
    ];

    protected $casts = [
        'requirements' => 'array',
        'target_value' => 'integer',
        'points_reward' => 'integer',
        'start_date' => 'date',
        'end_date' => 'date',
        'is_active' => 'boolean',
        'is_repeatable' => 'boolean',
        'participants_count' => 'integer',
        'completions_count' => 'integer',
    ];

    /**
     * Get the badge reward
     */
    public function badge(): BelongsTo
    {
        return $this->belongsTo(Badge::class);
    }

    /**
     * Get candidate progress
     */
    public function candidateChallenges(): HasMany
    {
        return $this->hasMany(CandidateChallenge::class);
    }

    /**
     * Get difficulty color
     */
    public function getDifficultyColorAttribute(): string
    {
        return match ($this->difficulty) {
            'hard' => '#EF4444',
            'medium' => '#F59E0B',
            'easy' => '#10B981',
            default => '#6B7280',
        };
    }

    /**
     * Check if challenge is active now
     */
    public function isActiveNow(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        $now = now()->toDateString();

        if ($this->start_date && $this->start_date > $now) {
            return false;
        }

        if ($this->end_date && $this->end_date < $now) {
            return false;
        }

        return true;
    }

    /**
     * Get completion rate
     */
    public function getCompletionRateAttribute(): float
    {
        if ($this->participants_count == 0) {
            return 0;
        }

        return round(($this->completions_count / $this->participants_count) * 100, 2);
    }

    /**
     * Scope for active challenges
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('start_date')
                    ->orWhere('start_date', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('end_date')
                    ->orWhere('end_date', '>=', now());
            });
    }

    /**
     * Scope by type
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope by category
     */
    public function scopeOfCategory($query, $category)
    {
        return $query->where('category', $category);
    }
}
