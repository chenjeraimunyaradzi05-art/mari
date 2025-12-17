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
        if (Schema::hasTable('rental_social_networks')) {
            return;
        }

        Schema::create('rental_social_networks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id_1')->comment('FK to users - initiator');
            $table->unsignedBigInteger('user_id_2')->comment('FK to users - recipient');
            $table->enum('connection_type', ['landlord_tenant', 'renter_renter', 'buyer_agent', 'connected'])->comment('Type of connection');
            $table->enum('status', ['pending', 'connected', 'blocked', 'rejected'])->default('pending');
            $table->text('message')->nullable()->comment('Initial connection message');
            $table->timestamp('connected_at')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('user_id_1')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('user_id_2')->references('id')->on('users')->onDelete('cascade');

            // Indexes
            $table->unique(['user_id_1', 'user_id_2']);
            $table->index('status');
            $table->index('connection_type');
            $table->index('connected_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rental_social_networks');
    }
};
