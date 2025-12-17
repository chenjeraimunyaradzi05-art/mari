<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $org_page_id
 * @property int $user_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\OrganizationPage $page
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgFollower newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgFollower newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgFollower query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgFollower whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgFollower whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgFollower whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgFollower whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrgFollower whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class OrgFollower extends Model
{
    use HasFactory;

    protected $fillable = [
        'org_page_id',
        'user_id',
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
