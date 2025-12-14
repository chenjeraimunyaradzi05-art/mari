<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * PropertyAminity Model
 *
 * @property int $id
 * @property int $property_id
 * @property int $aminity_id
 * @property int $status
 * @property-read \App\Models\Property $property
 * @property-read \App\Models\Aminity $aminity
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyAminity newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyAminity newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyAminity query()
 *
 * @mixin \Eloquent
 */
final class PropertyAminity extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['property_id', 'aminity_id', 'status'];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function aminity()
    {
        return $this->belongsTo(Aminity::class);
    }
}
