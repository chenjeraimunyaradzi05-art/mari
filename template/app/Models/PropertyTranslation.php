<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * PropertyTranslation Model
 *
 * @property int $id
 * @property int $property_id
 * @property string $title
 * @property string|null $address
 * @property string|null $description
 * @property string $lang_code
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyTranslation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyTranslation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyTranslation query()
 *
 * @mixin \Eloquent
 */
final class PropertyTranslation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['title', 'address', 'description'];
}
