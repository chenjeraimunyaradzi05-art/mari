<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrgPost extends Model
{
    protected $fillable = [
        'org_page_id','content','media_id','visibility','tags','likes','comments','shares','watch_time'
    ];

    protected $casts = [
        'tags' => 'array',
    ];
}
