<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdCampaign extends Model
{
    protected $fillable = [
        'org_page_id','objective','budget_cents','start_on','end_on','targeting','status'
    ];

    protected $casts = [
        'targeting' => 'array',
        'start_on' => 'date',
        'end_on' => 'date',
    ];
}
