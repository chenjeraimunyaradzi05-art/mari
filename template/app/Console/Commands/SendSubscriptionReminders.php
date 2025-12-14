<?php

namespace App\Console\Commands;

use App\Services\NotificationService;
use Illuminate\Console\Command;

final class SendSubscriptionReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'email:subscription-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send subscription expiry reminder emails to companies';

    /**
     * Execute the console command.
     */
    public function handle(NotificationService $notificationService): int
    {
        $this->info('Sending subscription expiry reminders...');

        $notificationService->sendSubscriptionExpiryReminders();

        $this->info('Subscription expiry reminders sent successfully!');

        return Command::SUCCESS;
    }
}

