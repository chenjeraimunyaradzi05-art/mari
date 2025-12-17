<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_post_reports')) {
            return;
        }

        Schema::create('social_post_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason', 60);
            $table->text('details')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewer_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->string('status', 30)->default('pending');
            $table->timestamps();

            $table->index(['social_post_id', 'status'], 'spr_post_status_idx');
            $table->index(['status', 'created_at'], 'spr_status_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_post_reports');
    }
};
