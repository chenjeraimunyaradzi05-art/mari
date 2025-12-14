<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $skill_id
 * @property string $title
 * @property string $type
 * @property string|null $url
 * @property string|null $provider
 * @property int|null $duration
 * @property string $difficulty
 * @property numeric|null $rating
 * @property string|null $description
 * @property numeric|null $price
 * @property string $language
 * @property array<array-key, mixed>|null $tags
 * @property bool $is_certified
 * @property bool $is_featured
 * @property int $enrollments
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string $difficulty_color
 * @property-read string $formatted_duration
 * @property-read string $price_display
 * @property-read string $type_icon
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateLearningProgress> $progress
 * @property int|null progress_count
 * @property-read \App\Models\Skill $skill
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource certified()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource featured()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource free()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource ofDifficulty($difficulty)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource ofType($type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereDifficulty($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereDuration($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereEnrollments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereIsCertified($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereIsFeatured($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereLanguage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource wherePrice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereRating($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereSkillId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearningResource whereUrl($value)
 *
 * @mixin \Eloquent
 */
final class LearningResource extends Model
{
    protected $fillable = [
        'skill_id',
        'title',
        'type',
        'url',
        'provider',
        'duration',
        'difficulty',
        'rating',
        'description',
        'price',
        'language',
        'tags',
        'is_certified',
        'is_featured',
        'enrollments',
        'is_active',
    ];

    protected $casts = [
        'duration' => 'integer',
        'rating' => 'decimal:2',
        'price' => 'decimal:2',
        'tags' => 'array',
        'is_certified' => 'boolean',
        'is_featured' => 'boolean',
        'enrollments' => 'integer',
        'is_active' => 'boolean',
    ];

    /**
     * Get the skill that this resource belongs to
     */
    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class);
    }

    /**
     * Get the progress records for this resource
     */
    public function progress(): HasMany
    {
        return $this->hasMany(CandidateLearningProgress::class);
    }

    /**
     * Get formatted duration
     */
    public function getFormattedDurationAttribute(): string
    {
        if (! $this->duration) {
            return 'N/A';
        }

        $hours = floor($this->duration / 60);
        $minutes = $this->duration % 60;

        if ($hours > 0) {
            return $minutes > 0 ? "{$hours}h {$minutes}m" : "{$hours}h";
        }

        return "{$minutes}m";
    }

    /**
     * Get price display
     */
    public function getPriceDisplayAttribute(): string
    {
        if ($this->price == 0) {
            return 'Free';
        }

        return '$'.number_format($this->price, 2);
    }

    /**
     * Get difficulty color
     */
    public function getDifficultyColorAttribute(): string
    {
        return match ($this->difficulty) {
            'beginner' => '#10B981',
            'intermediate' => '#F59E0B',
            'advanced' => '#E91E8C',
            default => '#6B7280',
        };
    }

    /**
     * Get type icon
     */
    public function getTypeIconAttribute(): string
    {
        return match ($this->type) {
            'course' => 'fa-graduation-cap',
            'tutorial' => 'fa-book-open',
            'book' => 'fa-book',
            'video' => 'fa-play-circle',
            'article' => 'fa-newspaper',
            'certification' => 'fa-certificate',
            default => 'fa-file',
        };
    }

    /**
     * Scope for active resources
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope for featured resources
     */
    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    /**
     * Scope by type
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope by difficulty
     */
    public function scopeOfDifficulty($query, $difficulty)
    {
        return $query->where('difficulty', $difficulty);
    }

    /**
     * Scope for free resources
     */
    public function scopeFree($query)
    {
        return $query->where('price', 0);
    }

    /**
     * Scope for certified resources
     */
    public function scopeCertified($query)
    {
        return $query->where('is_certified', true);
    }

    /**
     * Increment enrollments
     */
    public function incrementEnrollments(): void
    {
        $this->increment('enrollments');
    }
}
