<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourseIntake extends Model
{
    protected $fillable = [
        'course_id', 'start_on', 'apply_by', 'seats', 'scholarships'
    ];

    protected $casts = [
        'start_on' => 'date',
        'apply_by' => 'date',
        'scholarships' => 'array',
    ];
}
