<?php

/**
 * CustomPageBuilder Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $page_name
 * @property string $slug
 * @property string $content
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder whereContent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder wherePageName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder final whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CustomPageBuilder withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class CustomPageBuilder extends Model
{
    use HasFactory, Sluggable;

    /**
     * @return string[][]
     *
     * @psalm-return array{slug: array{source: 'page_name'}}
     */
    #[\Override]
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'page_name',
            ],
        ];
    }
}
