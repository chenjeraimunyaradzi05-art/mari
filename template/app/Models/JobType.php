<?php

/**
 * JobType Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Database\Factories\JobTypeFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType final whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobType withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class JobType extends Model
{
    use HasFactory, Sluggable;

    /**
     * @return string[][]
     *
     * @psalm-return array{slug: array{source: 'name'}}
     */
    #[\Override]
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'name',
            ],
        ];
    }
}
