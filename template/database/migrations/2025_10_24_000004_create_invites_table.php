<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up() {
        if (!Schema::hasTable('invites')) {
            Schema::create('invites', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('sender_id');
                $table->string('recipient_email')->nullable();
                $table->string('recipient_phone')->nullable();
                $table->string('status')->default('pending');
                $table->string('token')->nullable();
                $table->string('type')->nullable();
                $table->text('message')->nullable();
                $table->timestamps();
            });
        }
    }
    public function down() {
        Schema::dropIfExists('invites');
    }
};
