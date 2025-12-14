<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

final class DreamJobAlert extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'job_title', 'industry', 'location', 'min_salary', 'required_skills', 'employment_type', 'is_active', 'last_matched_at',
    ];

    protected $casts = [
        'required_skills' => 'array',
        'is_active' => 'boolean',
        'last_matched_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function matches()
    {
        return $this->hasMany(JobAlertMatch::class, 'dream_job_alert_id', 'id');
    }
}
