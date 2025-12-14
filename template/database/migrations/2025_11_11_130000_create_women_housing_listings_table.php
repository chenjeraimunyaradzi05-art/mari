<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('women_housing_listings', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('agent_profile_id')->nullable()->constrained('agent_profiles')->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->enum('listing_type', ['rent_shared', 'rent_private', 'buy', 'investment'])->default('rent_shared');
            $table->enum('audience', ['women_only', 'women_students', 'women_professionals', 'women_caregivers', 'women_retirees'])->default('women_only');
            $table->longText('description')->nullable();
            $table->unsignedBigInteger('price_cents')->nullable();
            $table->string('currency', 3)->default('AUD');
            $table->unsignedBigInteger('bond_cents')->nullable();
            $table->boolean('mortgage_required')->default(false);
            $table->json('location')->nullable();
            $table->json('amenities')->nullable();
            $table->date('availability_date')->nullable();
            $table->enum('verification_status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->enum('moderation_status', ['clean', 'flagged', 'under_review'])->default('clean');
            $table->enum('visibility', ['public', 'community', 'private'])->default('community');
            $table->json('ai_tags')->nullable();
            $table->float('ai_recommendation_score')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['owner_user_id', 'visibility']);
            $table->index(['listing_type', 'audience']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_housing_listings');
    }
};
