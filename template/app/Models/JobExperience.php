<?php

/**
 * JobExperience Model
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
 * @method static \Database\Factories\JobExperienceFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience final whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobExperience withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class JobExperience extends Model
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
