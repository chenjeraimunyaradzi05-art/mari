<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up() {
        if (!Schema::hasTable('badges')) {
            Schema::create('badges', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('description')->nullable();
                $table->string('icon')->nullable();
                $table->json('criteria')->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->timestamp('awarded_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->index(['user_id', 'awarded_at']);
            });
        }
    }
    public function down() {
        Schema::dropIfExists('badges');
    }
};
