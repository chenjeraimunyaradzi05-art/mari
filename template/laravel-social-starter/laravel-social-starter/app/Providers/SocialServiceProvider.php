<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\Ai\Ai;
use App\Services\Ai\DummyAiService;

class SocialServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Ai::class, function () {
            // Swap DummyAiService for a real provider by binding here
            return new DummyAiService();
        });
    }
}
