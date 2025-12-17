<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrgFollower extends Model
{
    protected $fillable = ['org_page_id', 'user_id'];
}
