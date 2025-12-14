<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $member_profile_id
 * @property string $file_path
 * @property bool $is_flagged
 * @property string|null $flag_reasons
 * @property string $moderation_status
 * @property string $media_type
 * @property string|null $caption
 * @property string $privacy_level
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\MemberProfile $profile
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereCaption($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereFilePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereFlagReasons($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereIsFlagged($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereMediaType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereMemberProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereModerationStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia wherePrivacyLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberMedia whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class MemberMedia extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'is_flagged' => 'boolean',
    ];

    public function profile()
    {
        return $this->belongsTo(MemberProfile::class, 'member_profile_id');
    }
}
