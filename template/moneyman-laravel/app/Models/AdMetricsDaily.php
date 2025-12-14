<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdMetricsDaily extends Model
{
    protected $fillable = [
        'campaign_id','date','impressions','clicks','views','watch_time_s','leads','cost_cents'
    ];

    protected $casts = [
        'date' => 'date',
    ];
}
