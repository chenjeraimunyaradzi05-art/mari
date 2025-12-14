<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * PropertyTypeTranslation Model
 *
 * @property int $id
 * @property int $property_type_id
 * @property string $title
 * @property string $lang_code
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyTypeTranslation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyTypeTranslation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyTypeTranslation query()
 *
 * @mixin \Eloquent
 */
final class PropertyTypeTranslation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['title'];
}
