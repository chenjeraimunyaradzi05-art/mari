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
        if (Schema::hasTable('rental_properties')) {
            return;
        }

        Schema::create('rental_properties', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id')->comment('FK to properties table');
            $table->unsignedBigInteger('landlord_user_id')->comment('FK to users - property owner');
            $table->decimal('monthly_rent', 12, 2)->comment('Monthly rental price');
            $table->decimal('security_deposit', 12, 2)->nullable()->comment('Security deposit amount');
            $table->enum('furnishing', ['unfurnished', 'partially_furnished', 'furnished'])->default('unfurnished');
            $table->enum('lease_term', ['monthly', 'quarterly', 'semi-annual', 'annual', 'flexible'])->default('annual');
            $table->integer('min_lease_months')->default(12)->comment('Minimum lease duration in months');
            $table->integer('max_lease_months')->nullable()->comment('Maximum lease duration, null = no limit');
            $table->date('available_from')->comment('Earliest occupancy date');
            $table->date('available_until')->nullable()->comment('Latest occupancy date, null = ongoing');
            $table->json('ai_preferences')->nullable()->comment('AI-learned tenant preferences');
            $table->text('house_rules')->nullable()->comment('Rental rules and conditions');
            $table->boolean('allows_pets')->default(false);
            $table->boolean('allows_smoking')->default(false);
            $table->boolean('allows_visitors')->default(true);
            $table->integer('max_occupants')->nullable()->comment('Maximum number of tenants allowed');
            $table->json('utilities_included')->nullable()->comment('Which utilities are included in rent');
            $table->integer('views_count')->default(0);
            $table->integer('inquiry_count')->default(0);
            $table->decimal('avg_rating', 3, 2)->nullable()->comment('Average tenant review rating');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            // Foreign key only to users table (properties is in dzimba module)
            $table->foreign('landlord_user_id')->references('id')->on('users')->onDelete('restrict');

            // Indexes
            $table->index('landlord_user_id');
            $table->index('property_id');
            $table->index('available_from');
            $table->index('furnishing');
            $table->index('lease_term');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rental_properties');
    }
};
