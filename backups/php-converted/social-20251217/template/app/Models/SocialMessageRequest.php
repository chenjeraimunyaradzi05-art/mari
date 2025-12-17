<?php

namespace App\Models;

use App\Enums\SocialMessageRequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $social_thread_id
 * @property int $requester_social_profile_id
 * @property int $target_social_profile_id
 * @property SocialMessageRequestStatus $status
 * @property int|null $decision_by_social_profile_id
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property string|null $auto_action
 * @property array<array-key, mixed>|null $context
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\SocialProfile|null $decisionBy
 * @property-read \App\Models\SocialProfile $requester
 * @property-read \App\Models\SocialProfile $target
 * @property-read \App\Models\SocialThread $thread
 * @method static \Database\Factories\SocialMessageRequestFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereAutoAction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereContext($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereDecisionBySocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereRequesterSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereSocialThreadId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest whereTargetSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequestwhereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageRequest withoutTrashed()
 * @mixin \Eloquent
 */
final class SocialMessageRequest extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'social_thread_id',
        'requester_social_profile_id',
        'target_social_profile_id',
        'status',
        'decision_by_social_profile_id',
        'expires_at',
        'auto_action',
        'context',
    ];

    protected $casts = [
        'status' => SocialMessageRequestStatus::class,
        'expires_at' => 'datetime',
        'context' => 'array',
    ];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(SocialThread::class, 'social_thread_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'requester_social_profile_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'target_social_profile_id');
    }

    public function decisionBy(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'decision_by_social_profile_id');
    }
}

