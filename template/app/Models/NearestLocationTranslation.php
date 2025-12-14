<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * NearestLocationTranslation Model
 *
 * @property int $id
 * @property int $nearest_location_id
 * @property string $title
 * @property string $lang_code
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|NearestLocationTranslation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|NearestLocationTranslation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|NearestLocationTranslation query()
 *
 * @mixin \Eloquent
 */
final class NearestLocationTranslation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['title'];
}
