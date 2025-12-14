<?php

/**
 * Footer Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $logo
 * @property string $copyright
 * @property string $details
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer whereCopyright($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer whereDetails($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer whereLogo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Footer whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Footer extends Model
{
    use HasFactory;

    protected $fillable = ['id', 'logo', 'details', 'copyright'];
}
