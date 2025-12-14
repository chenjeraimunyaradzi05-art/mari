<?php

use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_threads', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(SocialProfile::class, 'created_by_social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('thread_type', 32)->default('direct');
            $table->string('status', 32)->default('active');
            $table->string('message_request_mode', 32)->default('followers');
            $table->string('subject')->nullable();
            $table->boolean('is_system')->default(false);
            $table->decimal('spam_score', 5, 2)->default(0);
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('last_message_id')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamp('muted_by_system_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['thread_type', 'status']);
            $table->index('last_message_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_threads');
    }
};
