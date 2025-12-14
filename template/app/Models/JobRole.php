<?php

/**
 * JobRole Model
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
 * @method static \Database\Factories\JobRoleFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole final whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobRole withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class JobRole extends Model
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
