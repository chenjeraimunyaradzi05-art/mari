<?php

use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_thread_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_thread_id')->constrained('social_threads')->cascadeOnDelete();
            $table->foreignIdFor(SocialProfile::class, 'social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('role', 32)->default('member');
            $table->string('status', 32)->default('active');
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamp('last_read_at')->nullable();
            $table->unsignedBigInteger('last_read_message_id')->nullable();
            $table->timestamp('muted_at')->nullable();
            $table->boolean('notifications_enabled')->default(true);
            $table->json('settings')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['social_thread_id', 'social_profile_id'], 'st_participants_thread_profile_unique');
            $table->index(['social_profile_id', 'status'], 'st_participants_profile_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_thread_participants');
    }
};
