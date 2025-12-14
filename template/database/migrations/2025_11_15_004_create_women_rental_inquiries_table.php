<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('women_rental_inquiries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('rental_property_id');
            $table->unsignedBigInteger('property_seeker_id');
            $table->unsignedBigInteger('landlord_user_id');
            $table->text('inquiry_message');
            $table->enum('status', ['pending', 'interested', 'rejected', 'scheduled', 'accepted'])->default('pending');
            $table->integer('priority_score')->default(0);
            $table->timestamp('responded_at')->nullable();
            $table->text('landlord_response')->nullable();
            $table->timestamp('scheduled_tour_at')->nullable();
            $table->timestamp('tour_completed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('rental_property_id')->references('id')->on('women_rental_properties')->onDelete('cascade');
            $table->foreign('property_seeker_id')->references('id')->on('women_property_seekers')->onDelete('cascade');
            $table->foreign('landlord_user_id')->references('id')->on('users')->onDelete('restrict');
            $table->index('rental_property_id');
            $table->index('property_seeker_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_rental_inquiries');
    }
};
