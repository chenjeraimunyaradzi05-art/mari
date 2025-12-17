<?php

namespace App\Models;

use App\Enums\SocialMessageTemplateVisibility;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $owner_social_profile_id
 * @property int|null $company_id
 * @property SocialMessageTemplateVisibility $visibility
 * @property string $title
 * @property string $body
 * @property array<array-key, mixed>|null $placeholders
 * @property array<array-key, mixed>|null $usage_metrics
 * @property bool $is_locked
 * @property bool $is_default
 * @property \Illuminate\Support\Carbon|null $last_used_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\Company|null $company
 * @property-read \App\Models\SocialProfile $owner
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereBody($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereIsDefault($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereIsLocked($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereLastUsedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereOwnerSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate wherePlaceholders($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereUsageMetrics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageTemplate withoutTrashed()
 * @mixin \Eloquent
 */
final class SocialMessageTemplate extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'owner_social_profile_id',
        'company_id',
        'visibility',
        'title',
        'body',
        'placeholders',
        'usage_metrics',
        'is_locked',
        'is_default',
        'last_used_at',
    ];

    protected $casts = [
        'visibility' => SocialMessageTemplateVisibility::class,
        'placeholders' => 'array',
        'usage_metrics' => 'array',
        'is_locked' => 'boolean',
        'is_default' => 'boolean',
        'last_used_at' => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'owner_social_profile_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}

