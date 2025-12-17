<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_post_collection_id
 * @property int $social_post_id
 * @property int|null $social_post_save_id
 * @property \Illuminate\Support\Carbon $saved_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialPostCollection $collection
 * @property-read \App\Models\SocialPost $post
 * @property-read \App\Models\SocialPostSave|null $saveRecord
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem whereSavedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem whereSocialPostCollectionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem whereSocialPostSaveId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostCollectionItem whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialPostCollectionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_post_collection_id',
        'social_post_id',
        'social_post_save_id',
        'saved_at',
    ];

    protected $casts = [
        'saved_at' => 'datetime',
    ];

    public function collection(): BelongsTo
    {
        return $this->belongsTo(SocialPostCollection::class, 'social_post_collection_id');
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function saveRecord(): BelongsTo
    {
        return $this->belongsTo(SocialPostSave::class, 'social_post_save_id');
    }
}

