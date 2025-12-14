<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * PropertyPurpose Model
 *
 * @property int $id
 * @property int $status
 * @property-read \App\Models\PropertyPurposeTranslation $translation
 * @property-read \Illuminate\Database\Eloquent\Collection $translations
 * @property-read string|null $title
 * @property int|null translations_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyPurpose newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyPurpose newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyPurpose query()
 *
 * @mixin \Eloquent
 */
final class PropertyPurpose extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['status'];

    public function getTitleAttribute(): string
    {
        return $this->translation->title;
    }

    public function translation(): ?HasOne
    {
        return $this->hasOne(PropertyPurposeTranslation::class, 'property_purpose_id')->where('lang_code', getSessionLanguage());
    }

    public function getTranslation($code): ?PropertyPurposeTranslation
    {
        return $this->hasOne(PropertyPurposeTranslation::class, 'property_purpose_id')->where('lang_code', $code)->first();
    }

    public function translations(): ?HasMany
    {
        return $this->hasMany(PropertyPurposeTranslation::class, 'property_purpose_id');
    }
}
