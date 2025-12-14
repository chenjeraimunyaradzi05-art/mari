<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Opportunities\OpportunityRadarService;
use Illuminate\Console\Command;

final class RunOpportunityRadar extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'opportunity-radar:run {--user= : ID of a specific user to run for}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run the Opportunity Radar scan for users and generate alerts.';

    /**
     * Execute the console command.
     *
     * @psalm-return 0|1
     */
    public function handle(OpportunityRadarService $radarService): int
    {
        $userId = $this->option('user');

        if ($userId) {
            $user = User::find($userId);
            if (!$user) {
                $this->error("User with ID {$userId} not found.");
                return 1;
            }
            $this->info("Running Opportunity Radar for user: {$user->name}");
            $radarService->runForUser($user);
            $this->info("Done.");
            return 0;
        }

        // Run for all users who are candidates
        // We can optimize this to chunking
        $this->info("Running Opportunity Radar for all candidates...");

        User::whereHas('candidate')->chunk(100, function ($users) use ($radarService) {
            foreach ($users as $user) {
                $this->info("Processing user: {$user->id}");
                try {
                    $radarService->runForUser($user);
                } catch (\Exception $e) {
                    $this->error("Error processing user {$user->id}: " . $e->getMessage());
                }
            }
        });

        $this->info("Opportunity Radar scan completed.");
        return 0;
    }
}

