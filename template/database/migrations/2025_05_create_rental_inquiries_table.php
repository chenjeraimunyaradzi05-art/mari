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
        if (Schema::hasTable('rental_inquiries')) {
            return;
        }

        Schema::create('rental_inquiries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('rental_property_id')->comment('FK to rental_properties');
            $table->unsignedBigInteger('property_seeker_id')->comment('FK to property_seekers');
            $table->unsignedBigInteger('landlord_user_id')->comment('FK to users - landlord');
            $table->text('inquiry_message')->comment('Tenant\'s inquiry message');
            $table->enum('status', ['pending', 'interested', 'rejected', 'scheduled', 'accepted'])->default('pending');
            $table->integer('priority_score')->default(0)->comment('AI-calculated priority for landlord');
            $table->timestamp('responded_at')->nullable();
            $table->text('landlord_response')->nullable();
            $table->timestamp('scheduled_tour_at')->nullable();
            $table->timestamp('tour_completed_at')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('rental_property_id')->references('id')->on('rental_properties')->onDelete('cascade');
            $table->foreign('property_seeker_id')->references('id')->on('property_seekers')->onDelete('cascade');
            $table->foreign('landlord_user_id')->references('id')->on('users')->onDelete('restrict');

            // Indexes
            $table->index('rental_property_id');
            $table->index('property_seeker_id');
            $table->index('status');
            $table->index('priority_score');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rental_inquiries');
    }
};
