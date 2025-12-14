<?php

/**
 * JobBookmark Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $job_id
 * @property int $candidate_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Job|null $job
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBookmark newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBookmark newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBookmark query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBookmark whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBookmark whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBookmark whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBookmark whereJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobBookmark whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class JobBookmark extends Model
{
    use HasFactory;

    public function job(): BelongsTo
    {
        return $this->belongsTo(Job::class, 'job_id', 'id');
    }
}
