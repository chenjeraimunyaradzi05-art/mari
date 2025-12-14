<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdCreative extends Model
{
    protected $fillable = [
        'campaign_id','media_id','caption','cta','deeplink'
    ];
}
