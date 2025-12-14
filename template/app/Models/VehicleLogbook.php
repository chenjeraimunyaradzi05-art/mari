<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $vehicle_name
 * @property string $registration_number
 * @property string|null $make
 * @property string|null $model
 * @property int|null $year
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\VehicleLogbookEntry> $entries
 * @property int|null entries_count
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereMake($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereModel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereRegistrationNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereVehicleName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbook whereYear($value)
 * @mixin \Eloquent
 */
final class VehicleLogbook extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'vehicle_name',
        'registration_number',
        'make',
        'model',
        'year',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(VehicleLogbookEntry::class);
    }
}

