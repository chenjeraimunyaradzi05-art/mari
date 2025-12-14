<?php

namespace App\Models\Concerns;

use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Relations\MorphOne;

trait HasSocialProfile
{
    public function socialProfile(): MorphOne
    {
        return $this->morphOne(SocialProfile::class, 'profileable');
    }
}
