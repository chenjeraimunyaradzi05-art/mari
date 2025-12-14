<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up() {
        if (!Schema::hasTable('connections')) {
            Schema::create('connections', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('connected_user_id');
            $table->string('status')->default('pending');
            $table->string('type')->nullable();
            $table->unsignedBigInteger('initiator_id')->nullable();
            $table->timestamps();
            });
        }
    }
    public function down() {
        Schema::dropIfExists('connections');
    }
};
