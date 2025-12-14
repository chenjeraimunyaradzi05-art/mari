<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('women_cohort_timeline_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('profile_id')->constrained('women_cohort_profiles')->cascadeOnDelete();
            $table->string('event_type');
            $table->string('headline');
            $table->text('summary')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->string('fingerprint')->nullable()->unique();
            $table->timestamps();

            $table->index(['profile_id', 'occurred_at']);
            $table->index('event_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_cohort_timeline_events');
    }
};
