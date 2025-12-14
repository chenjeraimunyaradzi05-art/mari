<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $company_id
 * @property int $campaign_id
 * @property string $name
 * @property string $format
 * @property string $status
 * @property string $review_status
 * @property string|null $headline
 * @property string|null $primary_text
 * @property string|null $cta_label
 * @property string|null $destination_url
 * @property string|null $preview_image_url
 * @property string|null $preview_video_url
 * @property array<array-key, mixed>|null $insights
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\AdvertisingCampaign $campaign
 * @property-read \App\Models\Company $company
 * @property-read string $format_label
 * @property-read string $review_status_label
 * @property-read string $status_label
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereCampaignId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereCtaLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereDestinationUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereFormat($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereHeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereInsights($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative wherePreviewImageUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative wherePreviewVideoUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative wherePrimaryText($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereReviewStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdvertisingCreative withoutTrashed()
 * @method static Builder<static>|AdvertisingCreative live()
 *
 * @mixin \Eloquent
 */
final class AdvertisingCreative extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'insights' => 'array',
    ];

    public const STATUS_DRAFT = 'draft';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_PAUSED = 'paused';

    public const STATUS_ARCHIVED = 'archived';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_ACTIVE,
        self::STATUS_PAUSED,
        self::STATUS_ARCHIVED,
    ];

    public const REVIEW_PENDING = 'pending';

    public const REVIEW_APPROVED = 'approved';

    public const REVIEW_REJECTED = 'rejected';

    public const REVIEW_STATUSES = [
        self::REVIEW_PENDING,
        self::REVIEW_APPROVED,
        self::REVIEW_REJECTED,
    ];

    public const FORMATS = [
        'single_image' => 'Single image',
        'carousel' => 'Carousel',
        'video' => 'Video',
        'story' => 'Story',
        'text' => 'Text only',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AdvertisingCampaign::class, 'campaign_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function getFormatLabelAttribute(): string
    {
        return self::FORMATS[$this->format] ?? ucfirst(str_replace('_', ' ', (string) $this->format));
    }

    public function getStatusLabelAttribute(): string
    {
        return ucfirst(str_replace('_', ' ', (string) $this->status));
    }

    public function getReviewStatusLabelAttribute(): string
    {
        return ucfirst(str_replace('_', ' ', (string) $this->review_status));
    }

    public function isLaunchReady(): bool
    {
        return $this->status === self::STATUS_ACTIVE && $this->review_status === self::REVIEW_APPROVED;
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeLive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE)
            ->where('review_status', self::REVIEW_APPROVED);
    }
}
