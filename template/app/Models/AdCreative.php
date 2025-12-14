<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $campaign_id
 * @property int|null $media_id
 * @property string|null $format
 * @property string|null $caption
 * @property string|null $cta
 * @property string|null $deeplink
 * @property array<array-key, mixed>|null $meta
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\AdCampaign $campaign
 * @property-read \App\Models\OrgMediaAsset|null $media
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereCampaignId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereCta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereDeeplink($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereFormat($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereMediaId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AdCreative whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class AdCreative extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_LIVE = 'live';

    public const STATUS_PAUSED = 'paused';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_LIVE,
        self::STATUS_PAUSED,
    ];

    protected $fillable = [
        'campaign_id',
        'media_id',
        'format',
        'caption',
        'cta',
        'deeplink',
        'meta',
        'status',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AdCampaign::class, 'campaign_id');
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(OrgMediaAsset::class, 'media_id');
    }
}
