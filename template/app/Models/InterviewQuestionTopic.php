<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property string $icon
 * @property string $color
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null question_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\InterviewQuestion> $questions
 * @property int|null questions_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereColor($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereIcon($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereIsActive($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewQuestionTopic whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class InterviewQuestionTopic extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'color',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Boot the model
     */
    #[\Override]
    protected static function boot()
    {
        parent::boot();

        self::creating(function ($topic) {
            if (empty($topic->slug)) {
                $topic->slug = Str::slug($topic->name);
            }
        });
    }

    /**
     * Get all questions
     */
    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(InterviewQuestion::class);
    }

    /**
     * Scope for active topics
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get question count
     */
    public function getQuestionCountAttribute(): int
    {
        return $this->questions()->count();
    }
}
