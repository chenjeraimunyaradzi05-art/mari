<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('women_rental_properties', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('listing_id');
            $table->unsignedBigInteger('landlord_user_id');
            $table->decimal('monthly_rent', 12, 2)->comment('Monthly rental price');
            $table->decimal('security_deposit', 12, 2)->nullable();
            $table->enum('furnishing', ['unfurnished', 'partially_furnished', 'furnished'])->default('unfurnished');
            $table->enum('lease_term', ['monthly', 'quarterly', 'semi-annual', 'annual', 'flexible'])->default('annual');
            $table->integer('min_lease_months')->default(12);
            $table->integer('max_lease_months')->nullable();
            $table->date('available_from');
            $table->date('available_until')->nullable();
            $table->json('ai_preferences')->nullable();
            $table->text('house_rules')->nullable();
            $table->boolean('allows_pets')->default(false);
            $table->boolean('allows_smoking')->default(false);
            $table->boolean('allows_visitors')->default(true);
            $table->integer('max_occupants')->nullable();
            $table->json('utilities_included')->nullable();
            $table->integer('views_count')->default(0);
            $table->integer('inquiry_count')->default(0);
            $table->decimal('avg_rating', 3, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('listing_id')->references('id')->on('women_listings')->onDelete('cascade');
            $table->foreign('landlord_user_id')->references('id')->on('users')->onDelete('restrict');
            $table->index('landlord_user_id');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_rental_properties');
    }
};
