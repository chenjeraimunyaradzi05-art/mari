<?php

/**
 * JobTag Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $job_id
 * @property int $tag_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Tag|null $tag
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobTag newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobTag newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobTag query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobTag whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobTag whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobTag whereJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobTag whereTagId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobTag whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class JobTag extends Model
{
    use HasFactory;

    public function tag(): BelongsTo
    {
        return $this->belongsTo(Tag::class, 'tag_id', 'id');
    }
}
