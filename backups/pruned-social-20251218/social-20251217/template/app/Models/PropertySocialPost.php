<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * PropertySocialPost Model
 *
 * Bridge model connecting properties to social posts/shares.
 * Enables properties to be shared on the social feed with engagement tracking.
 *
 * @property int $id
 * @property int $property_id
 * @property int $user_id
 * @property int|null $post_id
 * @property string $caption
 * @property string $share_type (original, repost, listing_promotion)
 * @property int $shares_count
 * @property int $views_count
 * @property int $engagement_score
 * @property string|null $featured_image
 * @property bool $is_active
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property-read \App\Models\Property|null $property
 * @property-read User|null $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertySocialPost active()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertySocialPost byShareType($type)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertySocialPost newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertySocialPost newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertySocialPost query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertySocialPost recent($days = 7)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertySocialPost trending()
 *
 * @property-read Post|null $post
 *
 * @mixin \Eloquent
 */
final class PropertySocialPost extends Model
{
    use HasFactory;

    protected $table = 'property_social_posts';

    protected $fillable = [
        'property_id',
        'user_id',
        'post_id',
        'caption',
        'share_type',
        'shares_count',
        'views_count',
        'engagement_score',
        'featured_image',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relationship: Property
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * Relationship: User who shared the property
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relationship: Associated social Post (if created as native post)
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * Get engagement metrics
     *
     * @return (float|int)[]
     *
     * @psalm-return array{shares: int, views: int, engagement_score: int, engagement_rate: 0|float}
     */
    public function getEngagementMetrics(): array
    {
        return [
            'shares' => $this->shares_count,
            'views' => $this->views_count,
            'engagement_score' => $this->engagement_score,
            'engagement_rate' => $this->views_count > 0
                ? round(($this->shares_count / $this->views_count) * 100, 2)
                : 0,
        ];
    }

    /**
     * Increment views counter
     */
    public function recordView(): void
    {
        $this->increment('views_count');
        $this->recalculateEngagementScore();
    }

    /**
     * Increment shares counter
     */
    public function recordShare(): void
    {
        $this->increment('shares_count');
        $this->recalculateEngagementScore();
    }

    /**
     * Recalculate engagement score based on metrics
     */
    public function recalculateEngagementScore(): void
    {
        // Simple algorithm: (shares * 2) + views
        $this->engagement_score = ($this->shares_count * 2) + $this->views_count;
        $this->save();
    }

    /**
     * Scope: Active posts only
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: By share type
     */
    public function scopeByShareType($query, $type)
    {
        return $query->where('share_type', $type);
    }

    /**
     * Scope: Trending (ordered by engagement)
     */
    public function scopeTrending($query)
    {
        return $query->active()->orderByDesc('engagement_score')->limit(10);
    }

    /**
     * Scope: Recent shares
     */
    public function scopeRecent($query, $days = 7)
    {
        return $query->where('created_at', '>=', now()->subDays($days))->orderByDesc('created_at');
    }
}
