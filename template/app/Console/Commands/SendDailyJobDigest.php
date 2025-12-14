<?php

namespace App\Console\Commands;

use App\Services\NotificationService;
use Illuminate\Console\Command;

final class SendDailyJobDigest extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'email:daily-job-digest';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send daily job digest emails to candidates with new matching jobs';

    /**
     * Execute the console command.
     */
    public function handle(NotificationService $notificationService): int
    {
        $this->info('Sending daily job digest emails...');

        $notificationService->sendDailyJobDigest();

        $this->info('Daily job digest emails sent successfully!');

        return Command::SUCCESS;
    }
}

