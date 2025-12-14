<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * PropertyPurposeTranslation Model
 *
 * @property int $id
 * @property int $property_purpose_id
 * @property string $title
 * @property string $lang_code
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyPurposeTranslation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyPurposeTranslation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyPurposeTranslation query()
 *
 * @mixin \Eloquent
 */
final class PropertyPurposeTranslation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['title'];
}
