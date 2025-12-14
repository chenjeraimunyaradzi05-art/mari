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
        if (Schema::hasTable('ai_property_matches')) {
            return;
        }

        Schema::create('ai_property_matches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_seeker_id')->comment('FK to property_seekers');
            $table->unsignedBigInteger('rental_property_id')->nullable()->comment('FK to rental_properties');
            $table->unsignedBigInteger('property_id')->nullable()->comment('FK to properties for buy');
            $table->unsignedBigInteger('landlord_user_id')->nullable()->comment('For social context');
            $table->decimal('match_score', 5, 2)->comment('0-100 match percentage');
            $table->json('match_reasons')->comment('Why this property was matched');
            $table->json('match_breakdown')->comment('Score breakdown by category');
            $table->enum('match_status', ['matched', 'viewed', 'inquired', 'rejected', 'archived'])->default('matched');
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('inquired_at')->nullable();
            $table->text('seeker_note')->nullable()->comment('Seeker\'s note on match');
            $table->integer('relevance_rank')->nullable()->comment('Ranking among matches for this seeker');
            $table->boolean('is_ai_recommended')->default(true);
            $table->timestamps();

            // Foreign keys
            $table->foreign('property_seeker_id')->references('id')->on('property_seekers')->onDelete('cascade');
            $table->foreign('rental_property_id')->references('id')->on('rental_properties')->onDelete('cascade');
            // property_id FK commented out - properties table may not exist or is in different module
            // $table->foreign('property_id')->references('id')->on('properties')->onDelete('cascade');
            $table->foreign('landlord_user_id')->references('id')->on('users')->onDelete('set null');

            // Indexes
            $table->index('property_seeker_id');
            $table->index('match_score');
            $table->index('match_status');
            $table->index(['property_seeker_id', 'match_score']);
            $table->index('is_ai_recommended');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_property_matches');
    }
};
