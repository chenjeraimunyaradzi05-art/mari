<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $org_page_id
 * @property string $email
 * @property int|null $invited_by
 * @property string $channel
 * @property string $status
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $sent_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $inviter
 * @property-read \App\Models\OrganizationPage $page
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereChannel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereInvitedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereSentAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgInviteLog whereUpdatedAt($value)
 * @method static \Database\Factories\OrgInviteLogFactory factory($count = null, $state = [])
 *
 * @mixin \Eloquent
 */
final class OrgInviteLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'org_page_id',
        'email',
        'invited_by',
        'channel',
        'status',
        'meta',
        'sent_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'sent_at' => 'datetime',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }
}
