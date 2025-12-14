<?php

/**
 * LearnMore Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $image
 * @property string $title
 * @property string $main_title
 * @property string $sub_title
 * @property string|null $url
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore whereImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore whereMainTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore whereSubTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore whereTitle($value)
 * @method static\\Illuminate\Database\Eloquent\Builder<static>|LearnMore whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LearnMore whereUrl($value)
 *
 * @mixin \Eloquent
 */
final class LearnMore extends Model
{
    use HasFactory;

    protected $fillable = [
        'id', 'title', 'main_title', 'sub_title', 'url', 'image',
    ];
}
