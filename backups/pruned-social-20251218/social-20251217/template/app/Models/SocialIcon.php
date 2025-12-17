<?php
/**
 * SocialIcon Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $icon
 * @property string $url
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIcon newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIcon newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIcon query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIcon whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIcon whereIcon($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIcon whereId($value)
 * @method static \\Illuminate\Database\Eloquent\Builder<static>|SocialIcon whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialIcon whereUrl($value)
 * @mixin \Eloquent
 */
final class SocialIcon extends Model
{
    use HasFactory;
}

