<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * PropertyType Model
 *
 * @property int $id
 * @property string $slug
 * @property string|null $image
 * @property int $show_home1
 * @property int $show_home2
 * @property int $status
 * @property-read \App\Models\PropertyTypeTranslation $translation
 * @property-read \Illuminate\Database\Eloquent\Collection $translations
 * @property-read \Illuminate\Database\Eloquent\Collection $properties
 * @property-read string|null $title
 * @property int|null properties_count
 * @property int|null translations_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyType newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyType newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyType query()
 *
 * @mixin \Eloquent
 */
final class PropertyType extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['slug', 'image', 'show_home1', 'show_home2', 'status'];

    public function getTitleAttribute(): string
    {
        return $this->translation->title;
    }

    public function translation(): ?HasOne
    {
        return $this->hasOne(PropertyTypeTranslation::class, 'property_type_id')->where('lang_code', getSessionLanguage());
    }

    public function getTranslation($code): ?PropertyTypeTranslation
    {
        return $this->hasOne(PropertyTypeTranslation::class, 'property_type_id')->where('lang_code', $code)->first();
    }

    public function translations(): ?HasMany
    {
        return $this->hasMany(PropertyTypeTranslation::class, 'property_type_id');
    }

    public function properties()
    {
        $currentDate = date('Y-m-d');

        return $this->hasMany(Property::class, 'property_type_id')->whereRaw("STR_TO_DATE(expired_date, '%Y-%m-%d') >= ?", [$currentDate]);
    }
}
