<?php

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
 * @property-read \App\Models\Candidate|null $candidate
 * @property-read \App\Models\Job|null $job
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AppliedJob newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AppliedJob newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AppliedJob query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AppliedJob whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AppliedJob whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AppliedJob whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AppliedJob whereJobId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|AppliedJob whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class AppliedJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'job_id',
        'candidate_id',
    ];

    public function job(): BelongsTo
    {
        return $this->belongsTo(Job::class, 'job_id', 'id');
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class, 'candidate_id', 'user_id');
    }
}
