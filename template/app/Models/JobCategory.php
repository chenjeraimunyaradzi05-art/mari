<?php

namespace App\Models;

use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $icon
 * @property string $name
 * @property string $slug
 * @property int $show_at_popular
 * @property int $show_at_featured
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Job> $jobs
 * @property int|null jobs_count
 *
 * @method static \Database\Factories\JobCategoryFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory whereIcon($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory whereShowAtFeatured($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory whereShowAtPopular($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory whereUpdatedAt(final $value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobCategory withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class JobCategory extends Model
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

    public function jobs(): HasMany
    {
        return $this->hasMany(Job::class, 'job_category_id', 'id');
    }
}
