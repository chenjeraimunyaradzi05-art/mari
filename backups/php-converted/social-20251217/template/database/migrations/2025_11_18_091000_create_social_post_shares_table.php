<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_post_shares')) {
            return;
        }

        Schema::create('social_post_shares', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('social_post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->foreignId('social_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('channel', 30);
            $table->json('meta')->nullable();
            $table->timestamp('shared_at')->useCurrent();
            $table->timestamps();

            $table->index(['social_post_id', 'shared_at'], 'social_post_shares_post_shared_idx');
            $table->index(['channel', 'shared_at'], 'social_post_shares_channel_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_post_shares');
    }
};
