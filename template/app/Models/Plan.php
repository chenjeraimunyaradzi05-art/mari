<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $label
 * @property float $price
 * @property int $job_limit
 * @property int $featured_job_limit
 * @property int $highlight_job_limit
 * @property bool $profile_verified
 * @property bool $recommended
 * @property bool $frontend_show
 * @property bool $allow_social_posts
 * @property int $social_post_limit
 * @property int $show_at_home
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereAllowSocialPosts($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereFeaturedJobLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereFrontendShow($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereHighlightJobLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereJobLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan wherePrice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereProfileVerified($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereRecommended($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereShowAtHome($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereSocialPostLimit($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Plan whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Plan extends Model
{
    use HasFactory;

    protected $fillable = [
        'label',
        'price',
        'job_limit',
        'featured_job_limit',
        'highlight_job_limit',
        'profile_verified',
        'recommended',
        'frontend_show',
        'allow_social_posts',
        'social_post_limit',
    ];

    protected $casts = [
        'profile_verified' => 'boolean',
        'recommended' => 'boolean',
        'frontend_show' => 'boolean',
        'allow_social_posts' => 'boolean',
    ];
}
