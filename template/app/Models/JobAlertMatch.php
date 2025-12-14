<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class JobAlertMatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'dream_job_alert_id', 'job_posting_id', 'match_score', 'match_reasons', 'explanation',
    ];

    protected $casts = [
        'match_reasons' => 'array',
    ];

    public function alert(): BelongsTo
    {
        return $this->belongsTo(DreamJobAlert::class, 'dream_job_alert_id');
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(Job::class, 'job_posting_id');
    }
}
