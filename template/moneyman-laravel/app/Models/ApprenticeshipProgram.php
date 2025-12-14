<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApprenticeshipProgram extends Model
{
    protected $fillable = [
        'org_page_id','framework','level','rto_code','competencies'
    ];

    protected $casts = [
        'competencies' => 'array',
    ];
}
