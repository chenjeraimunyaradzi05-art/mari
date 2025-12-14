<?php

namespace App\Console\Commands;

use App\Http\Controllers\Fronted\CandidateDashboardController;
use App\Models\User;
use App\Support\Analytics\DashboardCache;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class CaptureDashboardSnapshots extends Command
{
    protected $signature = 'dashboard:snapshots {userId? : Candidate user id to render snapshots for}';

    protected $description = 'Capture HTML snapshots of the candidate dashboard for feature-flag permutations.';

    public function handle(): int
    {
        $user = $this->resolveUser();

        if (! $user) {
            $this->error('Unable to locate a candidate user for snapshot capture.');

            return self::FAILURE;
        }

        $scenarios = [
            'all-enabled' => [
                'welcome_pulse' => true,
                'persona_echo' => true,
                'opportunity_streams' => true,
            ],
            'all-disabled' => [
                'welcome_pulse' => false,
                'persona_echo' => false,
                'opportunity_streams' => false,
            ],
        ];

        $originalConfig = Config::get('features.candidate_dashboard', []);

        foreach ($scenarios as $label => $flags) {
            $this->info("Rendering dashboard snapshot: {$label}");

            foreach ($flags as $flag => $state) {
                Config::set("features.candidate_dashboard.{$flag}", $state);
            }

            DashboardCache::flushAll($user->id);
            Auth::shouldUse('web');
            Auth::setUser($user);

            try {
                $response = app(CandidateDashboardController::class)->index();
                $html = $response->render();
            } catch (Throwable $exception) {
                $this->error("Failed to render snapshot for {$label}: {$exception->getMessage()}");

                continue;
            }

            $filename = sprintf('snapshots/dashboard-%s-%s.html', Str::slug($label), now()->format('Ymd-His'));
            Storage::disk('local')->put($filename, $html);
            $this->info("Snapshot stored: storage/app/{$filename}");
        }

        Config::set('features.candidate_dashboard', $originalConfig);
        Auth::logout();

        return self::SUCCESS;
    }

    private function resolveUser(): User|null
    {
        $userId = $this->argument('userId');

        if ($userId) {
            return User::query()->whereKey($userId)->first();
        }

        return User::query()
            ->where('role', 'candidate')
            ->whereNotNull('email_verified_at')
            ->first();
    }
}

