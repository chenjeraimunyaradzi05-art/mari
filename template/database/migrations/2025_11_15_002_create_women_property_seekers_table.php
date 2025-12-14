<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('women_property_seekers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->enum('seeker_type', ['renter', 'buyer', 'investor'])->default('renter');
            $table->json('location_preferences')->nullable();
            $table->json('property_type_preferences')->nullable();
            $table->decimal('min_budget', 12, 2)->nullable();
            $table->decimal('max_budget', 12, 2)->nullable();
            $table->integer('min_bedrooms')->nullable();
            $table->integer('max_bedrooms')->nullable();
            $table->integer('min_bathrooms')->nullable();
            $table->integer('max_bathrooms')->nullable();
            $table->decimal('min_area', 10, 2)->nullable();
            $table->decimal('max_area', 10, 2)->nullable();
            $table->json('must_have_features')->nullable();
            $table->json('nice_to_have_features')->nullable();
            $table->enum('furnishing_preference', ['unfurnished', 'partially_furnished', 'furnished', 'any'])->default('any');
            $table->boolean('allows_pets')->nullable();
            $table->boolean('needs_parking')->default(false);
            $table->integer('preferred_move_in_days')->nullable();
            $table->json('lifestyle_preferences')->nullable();
            $table->json('ai_profile')->nullable();
            $table->json('match_history')->nullable();
            $table->integer('profile_completion_percentage')->default(0);
            $table->integer('total_views_received')->default(0);
            $table->integer('total_matches_found')->default(0);
            $table->integer('inquiries_sent')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('seeker_type');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_property_seekers');
    }
};
