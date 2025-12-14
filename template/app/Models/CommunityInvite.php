<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $community_group_id
 * @property int|null $community_chapter_id
 * @property int $sender_profile_id
 * @property int|null $recipient_profile_id
 * @property string|null $recipient_email
 * @property string|null $recipient_phone
 * @property string $token
 * @property string $status
 * @property string $source
 * @property array<array-key, mixed>|null $payload
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property \Illuminate\Support\Carbon|null $responded_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunityChapter|null $chapter
 * @property-read \App\Models\CommunityGroup $group
 * @property-read \App\Models\SocialProfile|null $recipient
 * @property-read \App\Models\SocialProfile $sender
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereCommunityChapterId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereRecipientEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereRecipientPhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereRecipientProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereRespondedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereSenderProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityInvite whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommunityInvite extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'community_chapter_id',
        'sender_profile_id',
        'recipient_profile_id',
        'recipient_email',
        'recipient_phone',
        'token',
        'status',
        'source',
        'payload',
        'expires_at',
        'responded_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'expires_at' => 'datetime',
        'responded_at' => 'datetime',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(CommunityChapter::class, 'community_chapter_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'sender_profile_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'recipient_profile_id');
    }
}
