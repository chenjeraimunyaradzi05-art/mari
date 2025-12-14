<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int|null $user_id
 * @property int|null $profile_id
 * @property int|null $social_profile_id
 * @property string $channel
 * @property string $privacy_tier
 * @property array<array-key, mixed>|null $requested_fields
 * @property array<array-key, mixed>|null $granted_fields
 * @property array<array-key, mixed>|null $denied_fields
 * @property string|null $decision
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon $checked_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereChannel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereCheckedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereDecision($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereDeniedFields($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereGrantedFields($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog wherePrivacyTier($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereRequestedFields($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PrivacyAccessLog whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class PrivacyAccessLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'profile_id',
        'social_profile_id',
        'channel',
        'privacy_tier',
        'requested_fields',
        'granted_fields',
        'denied_fields',
        'decision',
        'metadata',
        'checked_at',
    ];

    protected $casts = [
        'requested_fields' => 'array',
        'granted_fields' => 'array',
        'denied_fields' => 'array',
        'metadata' => 'array',
        'checked_at' => 'datetime',
    ];
}
