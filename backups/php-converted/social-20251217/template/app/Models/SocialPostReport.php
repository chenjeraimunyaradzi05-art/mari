<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_post_id
 * @property int $reporter_id
 * @property string $reason
 * @property string|null $details
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $reviewed_at
 * @property int|null $reviewer_id
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialPost $post
 * @property-read \App\Models\User $reporter
 * @property-read \App\Models\Admin|null $reviewer
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereDetails($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereReporterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereReviewerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostReport whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialPostReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_id',
        'reporter_id',
        'reason',
        'details',
        'meta',
        'reviewed_at',
        'reviewer_id',
        'status',
    ];

    protected $casts = [
        'meta' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'reviewer_id');
    }
}

