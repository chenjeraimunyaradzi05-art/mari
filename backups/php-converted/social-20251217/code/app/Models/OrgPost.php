<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $org_page_id
 * @property string|null $title
 * @property string|null $content
 * @property int|null $media_id
 * @property string $visibility
 * @property array<array-key, mixed>|null $tags
 * @property int $likes
 * @property int $comments
 * @property int $shares
 * @property int $watch_time
 * @property \Illuminate\Support\Carbon|null $scheduled_at
 * @property \Illuminate\Support\Carbon|null $published_at
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\OrgMediaAsset|null $media
 * @property-read \App\Models\OrganizationPage $page
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereComments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereLikes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereMediaId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereScheduledAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereShares($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPost whereWatchTime($value)
 *
 * @mixin \Eloquent
 */
final class OrgPost extends Model
{
    use HasFactory;

    protected $fillable = [
        'org_page_id',
        'title',
        'content',
        'media_id',
        'visibility',
        'tags',
        'likes',
        'comments',
        'shares',
        'watch_time',
        'scheduled_at',
        'published_at',
        'meta',
    ];

    protected $casts = [
        'tags' => 'array',
        'scheduled_at' => 'datetime',
        'published_at' => 'datetime',
        'meta' => 'array',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(OrgMediaAsset::class, 'media_id');
    }
}
