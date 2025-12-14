<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('advertising_slots', function (Blueprint $table) {
            $table->id();
            $table->string('key', 120)->unique();
            $table->string('name');
            $table->string('surface')->default('homepage');
            $table->string('channel')->default('web');
            $table->string('placement')->nullable();
            $table->string('category')->default('sponsorship');
            $table->unsignedTinyInteger('priority')->default(5);
            $table->unsignedTinyInteger('max_creatives')->default(3);
            $table->boolean('is_active')->default(true);
            $table->boolean('review_required')->default(true);
            $table->enum('brand_safety_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->json('allowed_formats')->nullable();
            $table->json('targeting_rules')->nullable();
            $table->json('pacing_rules')->nullable();
            $table->json('guardrails')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamp('last_reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['surface', 'channel']);
            $table->index(['is_active', 'brand_safety_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('advertising_slots');
    }
};
