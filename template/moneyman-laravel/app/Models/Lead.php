<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lead extends Model
{
    protected $fillable = [
        'org_page_id','type','payload','source','status','assigned_to','utm'
    ];

    protected $casts = [
        'payload' => 'array',
        'utm' => 'array',
    ];
}
