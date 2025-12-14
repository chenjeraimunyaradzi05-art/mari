<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Aminity Model
 *
 * @property int $id
 * @property string $slug
 * @property int $status
 * @property-read \App\Models\AminityTranslation $translation
 * @property-read \Illuminate\Database\Eloquent\Collection $translations
 * @property-read string|null $title
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PropertyAminity> $propertyAminities
 * @property int|null property_aminities_count
 * @property int|null translations_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Aminity newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Aminity newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Aminity query()
 *
 * @mixin \Eloquent
 */
final class Aminity extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['slug', 'status'];

    // make a accessor for translation
    public function getTitleAttribute(): string
    {
        return $this->translation->title;
    }

    public function translation(): ?HasOne
    {
        return $this->hasOne(AminityTranslation::class, 'aminity_id')->where('lang_code', getSessionLanguage());
    }

    public function getTranslation($code): ?AminityTranslation
    {
        return $this->hasOne(AminityTranslation::class, 'aminity_id')->where('lang_code', $code)->first();
    }

    public function translations(): ?HasMany
    {
        return $this->hasMany(AminityTranslation::class, 'aminity_id');
    }

    public function propertyAminities()
    {
        return $this->hasMany(PropertyAminity::class);
    }
}
