<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up() {
        if (!Schema::hasTable('invitations')) {
            Schema::create('invitations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('sender_id');
                $table->unsignedBigInteger('receiver_id');
                $table->string('type'); // connection, group, event, collaboration
                $table->text('message')->nullable();
                $table->string('status')->default('pending'); // pending, accepted, rejected
                $table->timestamps();

                $table->foreign('sender_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('receiver_id')->references('id')->on('users')->onDelete('cascade');
                $table->index('sender_id');
                $table->index('receiver_id');
                $table->index('status');
            });
        }
    }

    public function down() {
        Schema::dropIfExists('invitations');
    }
};
