<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\City> $cities
 * @property int|null cities_count
 * @property-read \App\Models\Country|null $country
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CountryState newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CountryState newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CountryState query()
 *
 * @mixin \Eloquent
 */
final class CountryState extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['country_id', 'title', 'slug', 'status'];

    public function country()
    {
        return $this->belongsTo(Country::class);
    }

    public function cities()
    {
        return $this->hasMany(City::class);
    }
}
