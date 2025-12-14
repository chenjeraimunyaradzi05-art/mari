<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('women_property_matches')) {
            return;
        }

        Schema::create('women_property_matches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_seeker_id');
            $table->unsignedBigInteger('rental_property_id')->nullable();
            $table->unsignedBigInteger('listing_id')->nullable();
            $table->unsignedBigInteger('landlord_user_id')->nullable();
            $table->decimal('match_score', 5, 2)->comment('0-100 match percentage');
            $table->json('match_reasons')->nullable();
            $table->json('match_breakdown')->nullable();
            $table->enum('match_status', ['matched', 'viewed', 'inquired', 'rejected', 'archived'])->default('matched');
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('inquired_at')->nullable();
            $table->text('seeker_note')->nullable();
            $table->integer('relevance_rank')->nullable();
            $table->boolean('is_ai_recommended')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('property_seeker_id')->references('id')->on('women_property_seekers')->onDelete('cascade');
            $table->foreign('rental_property_id')->references('id')->on('women_rental_properties')->onDelete('cascade');
            $table->foreign('listing_id')->references('id')->on('women_listings')->onDelete('cascade');
            $table->foreign('landlord_user_id')->references('id')->on('users')->onDelete('set null');
            $table->index('property_seeker_id');
            $table->index('match_score');
            $table->index('match_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_property_matches');
    }
};
