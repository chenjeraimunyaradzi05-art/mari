<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_post_id
 * @property int $social_profile_id
 * @property \Illuminate\Support\Carbon $saved_at
 * @property-read \App\Models\SocialPost $post
 * @property-read \App\Models\SocialProfile $profile
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostSave newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostSave newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostSave query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostSave whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostSave whereSavedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostSave whereSocialPostId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialPostSave whereSocialProfileId($value)
 * @mixin \Eloquent
 */
final class SocialPostSave extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'social_post_id',
        'social_profile_id',
        'saved_at',
    ];

    protected $casts = [
        'saved_at' => 'datetime',
    ];

    public function post(): BelongsTo
    {
        return $this->belongsTo(SocialPost::class, 'social_post_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }
}

