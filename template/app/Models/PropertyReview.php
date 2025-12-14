<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * PropertyReview Model
 *
 * @property int $id
 * @property int $user_id
 * @property int $property_id
 * @property string|null $comment
 * @property float $service_rating
 * @property float $location_rating
 * @property float $money_rating
 * @property float $clean_rating
 * @property float $avarage_rating
 * @property int $status
 * @property-read \App\Models\User $user
 * @property-read \App\Models\Property $property
 *
 * @method bool save(array $options = [])
 * @method bool update(array $attributes = [], array $options = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyReview newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyReview newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PropertyReview query()
 *
 * @mixin \Eloquent
 */
final class PropertyReview extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = ['user_id', 'property_id', 'comment', 'service_rating', 'location_rating', 'money_rating', 'clean_rating', 'avarage_rating', 'status'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function property()
    {
        return $this->belongsTo(Property::class)->with('translation');
    }
}
