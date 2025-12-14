<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('public_sector_agencies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('tagline')->nullable();
            $table->string('category')->default('federal');
            $table->string('hq_city')->nullable();
            $table->string('hq_country')->nullable();
            $table->string('hero_image')->nullable();
            $table->string('primary_contact')->nullable();
            $table->string('contact_email')->nullable();
            $table->json('focus_areas')->nullable();
            $table->json('service_regions')->nullable();
            $table->json('social_handles')->nullable();
            $table->decimal('impact_score', 5, 2)->default(0);
            $table->string('status')->default('draft');
            $table->text('summary')->nullable();
            $table->text('ai_summary')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_sector_agencies');
    }
};
