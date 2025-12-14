<?php

namespace App\Console\Commands;

use App\Services\NotificationService;
use Illuminate\Console\Command;

final class SendProfileReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'email:profile-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send profile completion reminder emails to candidates with incomplete profiles';

    /**
     * Execute the console command.
     */
    public function handle(NotificationService $notificationService): int
    {
        $this->info('Sending profile completion reminders...');

        $notificationService->sendProfileCompletionReminders();

        $this->info('Profile completion reminders sent successfully!');

        return Command::SUCCESS;
    }
}

