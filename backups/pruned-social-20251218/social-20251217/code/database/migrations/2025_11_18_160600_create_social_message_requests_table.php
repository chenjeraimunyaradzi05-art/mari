<?php

use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_message_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_thread_id')->constrained('social_threads')->cascadeOnDelete();
            $table->foreignIdFor(SocialProfile::class, 'requester_social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignIdFor(SocialProfile::class, 'target_social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('status', 32)->default('pending');
            $table->foreignIdFor(SocialProfile::class, 'decision_by_social_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->string('auto_action', 32)->nullable();
            $table->json('context')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['social_thread_id', 'target_social_profile_id'], 'sm_requests_thread_target_unique');
            $table->index(['target_social_profile_id', 'status'], 'sm_requests_target_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_message_requests');
    }
};
