<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('property_seekers')) {
            return;
        }

        Schema::create('property_seekers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->comment('FK to users - property seeker');
            $table->enum('seeker_type', ['renter', 'buyer', 'investor'])->comment('Type of property seeker');
            $table->json('location_preferences')->nullable()->comment('Preferred cities/areas');
            $table->json('property_type_preferences')->nullable()->comment('Preferred property types');
            $table->decimal('min_budget', 12, 2)->nullable()->comment('Minimum budget for monthly rent/purchase');
            $table->decimal('max_budget', 12, 2)->nullable()->comment('Maximum budget');
            $table->integer('min_bedrooms')->nullable();
            $table->integer('max_bedrooms')->nullable();
            $table->integer('min_bathrooms')->nullable();
            $table->integer('max_bathrooms')->nullable();
            $table->decimal('min_area', 10, 2)->nullable()->comment('Minimum area in sqft');
            $table->decimal('max_area', 10, 2)->nullable()->comment('Maximum area in sqft');
            $table->json('must_have_features')->nullable()->comment('Essential amenities/features');
            $table->json('nice_to_have_features')->nullable()->comment('Preferred but not essential features');
            $table->enum('furnishing_preference', ['unfurnished', 'partially_furnished', 'furnished', 'any'])->default('any');
            $table->boolean('allows_pets')->nullable()->comment('Need pet-friendly property');
            $table->boolean('needs_parking')->default(false);
            $table->integer('preferred_move_in_days')->nullable()->comment('Days from now for move-in');
            $table->json('lifestyle_preferences')->nullable()->comment('Lifestyle requirements (quiet, lively, etc)');
            $table->json('ai_profile')->nullable()->comment('AI-generated personality/preference profile');
            $table->json('match_history')->nullable()->comment('Previous matches and interactions');
            $table->integer('profile_completion_percentage')->default(0);
            $table->integer('total_views_received')->default(0);
            $table->integer('total_matches_found')->default(0);
            $table->integer('inquiries_sent')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            // Foreign keys
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

            // Indexes
            $table->unique('user_id');
            $table->index('seeker_type');
            $table->index('min_budget');
            $table->index('max_budget');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('property_seekers');
    }
};
