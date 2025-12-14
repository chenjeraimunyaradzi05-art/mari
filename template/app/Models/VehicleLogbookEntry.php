<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $vehicle_logbook_id
 * @property \Illuminate\Support\Carbon $date
 * @property int $odometer_start
 * @property int $odometer_end
 * @property int $distance
 * @property string $purpose
 * @property string|null $start_location
 * @property string|null $end_location
 * @property bool $business_use
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\VehicleLogbook $logbook
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereBusinessUse($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereDistance($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereEndLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereOdometerEnd($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereOdometerStart($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry wherePurpose($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereStartLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|VehicleLogbookEntry whereVehicleLogbookId($value)
 * @mixin \Eloquent
 */
final class VehicleLogbookEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_logbook_id',
        'date',
        'odometer_start',
        'odometer_end',
        'distance',
        'purpose',
        'start_location',
        'end_location',
        'business_use',
    ];

    protected $casts = [
        'date' => 'date',
        'business_use' => 'boolean',
    ];

    public function logbook(): BelongsTo
    {
        return $this->belongsTo(VehicleLogbook::class, 'vehicle_logbook_id');
    }
}

