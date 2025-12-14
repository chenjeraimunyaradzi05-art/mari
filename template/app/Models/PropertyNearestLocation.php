<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * PropertyNearestLocation Model
 *
 * @property int $id
 * @property int $property_id
 * @property int $nearest_place_id
 * @property string $distance
 * @property-read \App\Models\Property $property
 * @property-read \App\Models\NearestLocation $nearestLocation
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyNearestLocation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyNearestLocation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyNearestLocation query()
 *
 * @mixin \Eloquent
 */
final class PropertyNearestLocation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['property_id', 'nearest_place_id', 'distance'];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function nearestLocation()
    {
        return $this->belongsTo(NearestLocation::class, 'nearest_place_id')->with('translation');
    }
}
