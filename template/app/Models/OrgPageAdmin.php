<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $org_page_id
 * @property int $user_id
 * @property string $role
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\OrganizationPage $page
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgPageAdmin whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class OrgPageAdmin extends Model
{
    use HasFactory;

    protected $fillable = [
        'org_page_id',
        'user_id',
        'role',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
