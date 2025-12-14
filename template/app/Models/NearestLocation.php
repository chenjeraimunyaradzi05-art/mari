<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * NearestLocation Model
 *
 * @property int $id
 * @property string $slug
 * @property int $status
 * @property-read \App\Models\NearestLocationTranslation $translation
 * @property-read \Illuminate\Database\Eloquent\Collection $translations
 * @property-read string|null $title
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PropertyNearestLocation> $locations
 * @property int|null locations_count
 * @property int|null translations_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|NearestLocation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|NearestLocation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|NearestLocation query()
 *
 * @mixin \Eloquent
 */
final class NearestLocation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['slug', 'status'];

    public function getTitleAttribute(): string
    {
        return $this->translation->title;
    }

    public function translation(): ?HasOne
    {
        return $this->hasOne(NearestLocationTranslation::class, 'location_id')->where('lang_code', getSessionLanguage());
    }

    public function getTranslation($code): ?NearestLocationTranslation
    {
        return $this->hasOne(NearestLocationTranslation::class, 'location_id')->where('lang_code', $code)->first();
    }

    public function translations(): ?HasMany
    {
        return $this->hasMany(NearestLocationTranslation::class, 'location_id');
    }

    public function locations()
    {
        return $this->hasMany(PropertyNearestLocation::class, 'nearest_place_id');
    }
}
