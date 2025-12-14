<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $group_id
 * @property int $user_id
 * @property string $role
 * @property \Illuminate\Support\Carbon|null $joined_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Group $group
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember admins()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember members()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember moderators()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereJoinedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereUpdatedAt(final $value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GroupMember whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class GroupMember extends Model
{
    protected $fillable = [
        'group_id',
        'user_id',
        'role',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the group that owns the membership.
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    /**
     * Get the user associated with this membership.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope to get admin members.
     */
    public function scopeAdmins($query)
    {
        return $query->where('role', 'admin');
    }

    /**
     * Scope to get moderators.
     */
    public function scopeModerators($query)
    {
        return $query->where('role', 'moderator');
    }

    /**
     * Scope to get regular members.
     */
    public function scopeMembers($query)
    {
        return $query->where('role', 'member');
    }

    /**
     * Check if member is admin.
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Check if member is moderator.
     */
    public function isModerator(): bool
    {
        return $this->role === 'moderator';
    }

    /**
     * Promote member to moderator.
     */
    public function promoteToModerator(): void
    {
        $this->update(['role' => 'moderator']);
    }

    /**
     * Promote member to admin.
     */
    public function promoteToAdmin(): void
    {
        $this->update(['role' => 'admin']);
    }

    /**
     * Demote member to regular member.
     */
    public function demoteToMember(): void
    {
        $this->update(['role' => 'member']);
    }
}
