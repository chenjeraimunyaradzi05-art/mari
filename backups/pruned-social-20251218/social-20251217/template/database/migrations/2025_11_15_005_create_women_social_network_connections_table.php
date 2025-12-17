<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('women_social_network_connections', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id_1');
            $table->unsignedBigInteger('user_id_2');
            $table->enum('connection_type', ['landlord_tenant', 'renter_renter', 'buyer_agent', 'connected'])->default('connected');
            $table->enum('status', ['pending', 'connected', 'blocked', 'rejected'])->default('pending');
            $table->text('message')->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('user_id_1')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('user_id_2')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['user_id_1', 'user_id_2']);
            $table->index('status');
            $table->index('connection_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_social_network_connections');
    }
};
