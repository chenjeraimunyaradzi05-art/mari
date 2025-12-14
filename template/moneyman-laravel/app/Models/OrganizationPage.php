<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrganizationPage extends Model
{
    protected $fillable = [
        'org_id', 'type', 'slug', 'name', 'tagline', 'cover_media_id', 'verification_status', 'safety_score',
    ];

    public function media(): HasMany { return $this->hasMany(OrgMediaAsset::class); }
    public function posts(): HasMany { return $this->hasMany(OrgPost::class); }
    public function followers(): HasMany { return $this->hasMany(OrgFollower::class); }
    public function courses(): HasMany { return $this->hasMany(Course::class, 'provider_org_page_id'); }
}
