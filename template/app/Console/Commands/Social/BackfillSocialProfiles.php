<?php

namespace App\Console\Commands\Social;

use App\Models\SocialProfile;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;

final class BackfillSocialProfiles extends Command
{
    protected $signature = 'social:profiles:backfill-users {--chunk=100} {--dry-run}';

    protected $description = 'Ensure social profiles store their owning user reference.';

    public function handle(): int
    {
        $chunk = (int) $this->option('chunk');
        $dryRun = (bool) $this->option('dry-run');

        $updated = 0;
        $skipped = 0;

        SocialProfile::query()->whereNull('user_id')
            ->chunk($chunk ?: 100, function ($profiles) use (&$updated, &$skipped, $dryRun) {
                foreach ($profiles as $profile) {
                    $ownerUser = $profile->resolveOwnerUser();

                    if ($ownerUser instanceof User) {
                        if (! $dryRun) {
                            $profile->user_id = $ownerUser->id;
                            $profile->save();
                        }

                        $updated++;
                        continue;
                    }

                    $skipped++;
                }
            });

        $this->info(sprintf('Profiles updated: %d', $updated));
        $this->info(sprintf('skipped: %d', $skipped));

        return Command::SUCCESS;
    }
}

