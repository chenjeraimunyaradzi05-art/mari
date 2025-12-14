<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $community_group_id
 * @property int|null $community_chapter_id
 * @property int $uploaded_by_profile_id
 * @property string $resource_type
 * @property string $source_type
 * @property string $title
 * @property string $slug
 * @property string $disk
 * @property string|null $file_path
 * @property string|null $external_url
 * @property array<array-key, mixed>|null $tags
 * @property string $visibility
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunityChapter|null $chapter
 * @property-read \App\Models\CommunityGroup $group
 * @property-read \App\Models\SocialProfile $uploader
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereCommunityChapterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereDisk($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereExternalUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereFilePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereResourceType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereSourceType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereUploadedByProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityResource whereVisibility($value)
 *
 * @mixin \Eloquent
 */
final class CommunityResource extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'community_chapter_id',
        'uploaded_by_profile_id',
        'resource_type',
        'source_type',
        'title',
        'slug',
        'disk',
        'file_path',
        'external_url',
        'tags',
        'visibility',
        'metadata',
    ];

    protected $casts = [
        'tags' => 'array',
        'metadata' => 'array',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(CommunityChapter::class, 'community_chapter_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'uploaded_by_profile_id');
    }
}
