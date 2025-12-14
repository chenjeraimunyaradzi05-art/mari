<?php

/**
 * About Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $image
 * @property string $title
 * @property string $description
 * @property string|null $url
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About whereImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|About whereUrl($value)
 *
 * @mixin \Eloquent
 */
final class About extends Model
{
    use HasFactory;

    protected $fillable = ['id', 'image', 'title', 'description', 'url'];
}
