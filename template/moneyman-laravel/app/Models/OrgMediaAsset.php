<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrgMediaAsset extends Model
{
    protected $fillable = [
        'org_page_id', 'type', 'storage_path', 'duration', 'captions_path', 'safety_labels', 'status'
    ];

    protected $casts = [
        'safety_labels' => 'array',
    ];
}
