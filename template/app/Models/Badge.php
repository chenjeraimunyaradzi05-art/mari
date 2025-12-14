<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property string|null $icon
 * @property array<array-key, mixed>|null $criteria
 * @property int|null $user_id
 * @property string|null $awarded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateBadge> $candidateBadges
 * @property int|null candidate_badges_count
 * @property-read string $rarity_color
 * @property-read string $rarity_label
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge ofCategory($category)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge ofRarity($rarity)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereAwardedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereCriteria($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereIcon($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Badge whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class Badge extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'color',
        'category',
        'rarity',
        'criteria',
        'points_reward',
        'is_active',
        'earned_count',
    ];

    protected $casts = [
        'criteria' => 'array',
        'points_reward' => 'integer',
        'is_active' => 'boolean',
        'earned_count' => 'integer',
    ];

    /**
     * Boot method
     */
    #[\Override]
    protected static function boot()
    {
        parent::boot();

        self::creating(function ($badge) {
            if (empty($badge->slug)) {
                $badge->slug = Str::slug($badge->name);
            }
        });
    }

    /**
     * Get candidates who earned this badge
     */
    public function candidateBadges(): HasMany
    {
        return $this->hasMany(CandidateBadge::class);
    }

    /**
     * Get rarity color
     */
    public function getRarityColorAttribute(): string
    {
        return match ($this->rarity) {
            'legendary' => '#FFD700',
            'epic' => '#A855F7',
            'rare' => '#3B82F6',
            'common' => '#6B7280',
            default => '#9CA3AF',
        };
    }

    /**
     * Get rarity label
     */
    public function getRarityLabelAttribute(): string
    {
        return ucfirst($this->rarity);
    }

    /**
     * Increment earned count
     */
    public function incrementEarnedCount(): void
    {
        $this->increment('earned_count');
    }

    /**
     * Scope for active badges
     */
    public function scopeActive($query)
    {
        $table = $query->getModel()->getTable();

        if (Schema::hasColumn($table, 'is_active')) {
            return $query->where('is_active', true);
        }

        return $query;
    }

    /**
     * Scope by category
     */
    public function scopeOfCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    /**
     * Scope by rarity
     */
    public function scopeOfRarity($query, $rarity)
    {
        return $query->where('rarity', $rarity);
    }
}
