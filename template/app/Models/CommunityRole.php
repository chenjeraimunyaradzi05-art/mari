<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int|null $community_group_id
 * @property string $name
 * @property string $slug
 * @property string $scope
 * @property int $hierarchy_level
 * @property array<array-key, mixed>|null $permissions
 * @property bool $is_default
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\CommunityGroup|null $group
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CommunityMembership> $memberships
 * @property int|null memberships_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereCommunityGroupId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereHierarchyLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereIsDefault($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole wherePermissions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereScope($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CommunityRole whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CommunityRole extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_group_id',
        'name',
        'slug',
        'scope',
        'hierarchy_level',
        'permissions',
        'is_default',
    ];

    protected $casts = [
        'permissions' => 'array',
        'is_default' => 'boolean',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(CommunityGroup::class, 'community_group_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(CommunityMembership::class, 'community_role_id');
    }

    public function grants(string $permission): bool
    {
        $permissions = $this->permissions ?? [];

        if (in_array('*', $permissions, true)) {
            return true;
        }

        return in_array($permission, $permissions, true);
    }
}
