<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Course extends Model
{
    protected $fillable = [
        'provider_org_page_id','code','title','type','mode','location','duration_weeks',
        'cost_cents','funding','prerequisites','outcomes','tags'
    ];

    protected $casts = [
        'funding' => 'array',
        'prerequisites' => 'array',
        'outcomes' => 'array',
        'tags' => 'array',
    ];

    public function intakes(): HasMany { return $this->hasMany(CourseIntake::class); }
}
