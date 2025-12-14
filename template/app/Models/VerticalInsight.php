<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $vertical_slug
 * @property string $vertical_name
 * @property int $open_roles
 * @property int $courses
 * @property int $mentors
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $refreshed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static Builder<static>|VerticalInsight forSlug(string $slug)
 * @method static Builder<static>|VerticalInsight newModelQuery()
 * @method static Builder<static>|VerticalInsight newQuery()
 * @method static Builder<static>|VerticalInsight ordered()
 * @method static Builder<static>|VerticalInsight query()
 * @method static Builder<static>|VerticalInsight whereCourses($value)
 * @method static Builder<static>|VerticalInsight whereCreatedAt($value)
 * @method static Builder<static>|VerticalInsight whereId($value)
 * @method static Builder<static>|VerticalInsight whereMentors($value)
 * @method static Builder<static>|VerticalInsight whereMeta($value)
 * @method static Builder<static>|VerticalInsight whereOpenRoles($value)
 * @method static Builder<static>|VerticalInsight whereRefreshedAt($value)
 * @method static Builder<static>|VerticalInsight whereUpdatedAt($value)
 * @final method static Builder<static>|VerticalInsight whereVerticalName($value)
 * @method static Builder<static>|VerticalInsight whereVerticalSlug($value)
 * @mixin \Eloquent
 */
class VerticalInsight extends Model
{
    use HasFactory;

    protected $fillable = [
        'vertical_slug',
        'vertical_name',
        'open_roles',
        'courses',
        'mentors',
        'meta',
        'refreshed_at',
    ];

    protected $casts = [
        'open_roles' => 'integer',
        'courses' => 'integer',
        'mentors' => 'integer',
        'meta' => 'array',
        'refreshed_at' => 'datetime',
    ];

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderByDesc('open_roles')->orderBy('vertical_name');
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeForSlug(Builder $query, string $slug): Builder
    {
        return $query->where('vertical_slug', $slug);
    }
}
