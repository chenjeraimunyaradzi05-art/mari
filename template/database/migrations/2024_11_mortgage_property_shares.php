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
        if (!Schema::hasTable('property_mortgage_shares')) {
            Schema::create('property_mortgage_shares', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('property_social_post_id')->comment('FK to property_social_posts');
                $table->unsignedBigInteger('property_id')->comment('FK to properties');
                $table->unsignedBigInteger('user_id')->comment('FK to users - who shared it');
                $table->enum('mortgage_perspective', ['buyer', 'investor', 'realtor'])->default('buyer')->comment('Perspective from which property is shared');
                $table->decimal('loan_amount', 15, 2)->comment('Mortgage loan amount at time of share');
                $table->decimal('monthly_payment', 10, 2)->comment('Calculated monthly payment');
                $table->decimal('readiness_score', 5, 1)->comment('Financing readiness 0-100');
                $table->decimal('ltv', 5, 2)->comment('Loan-to-value percentage');
                $table->timestamps();

                // Indexes for query optimization
                // Note: Foreign keys commented out to avoid table dependency issues
                // Re-enable after all tables are created
                // $table->foreign('property_social_post_id')->references('id')->on('property_social_posts')->onDelete('cascade');
                // $table->foreign('property_id')->references('id')->on('properties')->onDelete('cascade');
                // $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->index('mortgage_perspective');
                $table->index(['property_id', 'created_at']);
                $table->index(['user_id', 'created_at']);
                $table->index('property_social_post_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('property_mortgage_shares');
    }
};
