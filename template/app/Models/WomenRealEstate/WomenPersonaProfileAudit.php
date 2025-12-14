<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $persona_profile_id
 * @property int|null $performed_by
 * @property array<array-key, mixed>|null $changes
 * @property array<array-key, mixed>|null $visibility_snapshot
 * @property string|null $reason
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read User|null $actor
 * @property-read \App\Models\WomenRealEstate\WomenPersonaProfile $profile
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit whereChanges($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit wherePerformedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit wherePersonaProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenPersonaProfileAudit whereVisibilitySnapshot($value)
 * @mixin \Eloquent
 */
final class WomenPersonaProfileAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'persona_profile_id',
        'performed_by',
        'changes',
        'visibility_snapshot',
        'reason',
    ];

    protected $casts = [
        'changes' => 'array',
        'visibility_snapshot' => 'array',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(WomenPersonaProfile::class, 'persona_profile_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}

