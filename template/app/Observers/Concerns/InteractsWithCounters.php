<?php

namespace App\Observers\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\DB;

trait InteractsWithCounters
{
    protected function adjustCounter(Model $model, string $column, int $delta): void
    {
        if ($delta === 0) {
            return;
        }

        $method = $delta > 0 ? 'increment' : 'decrement';

        DB::table($model->getTable())
            ->where($model->getKeyName(), $model->getKey())
            ->{$method}($column, abs($delta));

        $model->setAttribute(
            $column,
            max(0, (int) $model->getAttribute($column) + $delta),
        );
    }

    protected function resolveRelation(Model $model, string $relation): ?Model
    {
        if (! method_exists($model, $relation)) {
            return null;
        }

        if ($model->relationLoaded($relation)) {
            $related = $model->getRelation($relation);

            return $related instanceof Model ? $related : null;
        }

        $relationInstance = $model->{$relation}();

        return $relationInstance instanceof Relation ? $relationInstance->first() : null;
    }
}
