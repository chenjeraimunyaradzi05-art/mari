<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * PropertyImage Model
 *
 * @property int $id
 * @property int $property_id
 * @property string $image
 * @property-read string $image_url
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyImage newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyImage newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyImage query()
 *
 * @mixin \Eloquent
 */
final class PropertyImage extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['property_id', 'image'];

    public function getImageUrlAttribute(): string
    {
        if ($this->image) {
            return asset($this->image);
        }

        return asset('backend/img/no-image.png');
    }
}
