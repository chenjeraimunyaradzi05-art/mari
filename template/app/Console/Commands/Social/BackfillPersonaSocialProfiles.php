<?php

namespace App\Console\Commands\Social;

use App\Models\Profile;
use App\Services\Social\SocialProfileProvisioner;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;

final class BackfillPersonaSocialProfiles extends Command
{
    protected $signature = 'social:personas:backfill {--chunk=100} {--dry-run} {--profile-id=}';

    protected $description = 'Provision social profiles for personas that are missing them.';
}

