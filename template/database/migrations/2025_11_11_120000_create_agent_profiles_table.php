<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('agent_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('social_profile_id')->nullable()->unique()->constrained('social_profiles')->nullOnDelete();
            $table->string('headline')->nullable();
            $table->text('bio')->nullable();
            $table->unsignedTinyInteger('experience_years')->default(0);
            $table->json('transaction_focus')->nullable();
            $table->json('service_regions')->nullable();
            $table->enum('availability_status', ['available', 'waitlist', 'offline'])->default('available');
            $table->string('calendly_url')->nullable();
            $table->string('video_pitch_url')->nullable();
            $table->timestamps();

            $table->index(['availability_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_profiles');
    }
};
