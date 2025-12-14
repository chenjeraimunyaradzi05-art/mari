<?php

/**
 * Hero Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $image
 * @property string $background_image
 * @property string $title
 * @property string $sub_title
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero whereBackgroundImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero whereImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero whereSubTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Hero whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Hero extends Model
{
    use HasFactory;

    protected $fillable = ['image', 'background_image', 'title', 'sub_title'];
}
