<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tafe_institutions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->enum('institution_type', ['tafe', 'university', 'rto'])->default('tafe');
            $table->string('tagline')->nullable();
            $table->text('summary')->nullable();
            $table->text('mission_statement')->nullable();
            $table->string('brand_color')->nullable();
            $table->string('hero_image')->nullable();
            $table->string('website_url')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone')->nullable();
            $table->json('location')->nullable();
            $table->json('specialties')->nullable();
            $table->json('support_channels')->nullable();
            $table->json('ai_strengths')->nullable();
            $table->json('impact_metrics')->nullable();
            $table->enum('status', ['draft', 'review', 'live', 'paused'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['institution_type', 'status']);
            $table->index('owner_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tafe_institutions');
    }
};
