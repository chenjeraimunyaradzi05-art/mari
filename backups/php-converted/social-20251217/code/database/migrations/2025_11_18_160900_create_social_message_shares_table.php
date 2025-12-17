<?php

use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_message_shares', function (Blueprint $table) {
            $table->id();
            $table->string('shareable_type');
            $table->unsignedBigInteger('shareable_id');
            $table->foreignIdFor(SocialProfile::class, 'source_social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignId('target_social_thread_id')->constrained('social_threads')->cascadeOnDelete();
            $table->string('status', 32)->default('queued');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['shareable_type', 'shareable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_message_shares');
    }
};
