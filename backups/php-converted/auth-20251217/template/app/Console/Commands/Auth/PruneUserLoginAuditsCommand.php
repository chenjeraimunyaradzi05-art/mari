<?php

namespace App\Console\Commands\Auth;

use App\Models\UserLoginAudit;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

final class PruneUserLoginAuditsCommand extends Command
{
    protected $signature = 'auth:login-audits:prune
        {--days= : Number of days to retain login audits}
        {--chunk= : Number of rows to delete per chunk}';

    protected $description = 'Delete user login audit rows older than the configured retention window.';

    private function resolveRetentionDays(): int
    {
        $option = $this->option('days');

        if ($option !== null && $option !== '') {
            return (int) $option;
        }

        return (int) config('auth.login_audits.retention_days', 90);
    }

    private function resolveChunkSize(): int
    {
        $option = $this->option('chunk');

        if ($option !== null && $option !== '') {
            return max(100, (int) $option);
        }

        return (int) config('auth.login_audits.prune_chunk', 1000);
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = $this->resolveRetentionDays();
        $chunk = $this->resolveChunkSize();

        $cutoff = Carbon::now()->subDays($days);

        $deleted = 0;

        UserLoginAudit::query()
            ->where('logged_in_at', '<', $cutoff)
            ->orderBy('id')
            ->chunkById($chunk, function ($rows) use (&$deleted) {
                foreach ($rows as $row) {
                    $row->delete();
                    $deleted++;
                }
            });

        $this->info(sprintf('Pruned %d user login audits older than %d days', $deleted, $days));

        return 0;
    }

    /**
     * Backwards-compatible invokable entry point used by some schedulers/tests.
     */
    public function __invoke(): int
    {
        return $this->handle();
    }
}

