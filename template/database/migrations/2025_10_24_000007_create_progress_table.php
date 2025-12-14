<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up() {
        if (!Schema::hasTable('progress')) {
            Schema::create('progress', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('type');
                $table->integer('value')->default(0);
                $table->integer('target')->default(100);
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->index(['user_id', 'type']);
                $table->unique(['user_id', 'type']);
            });
        }
    }
    public function down() {
        Schema::dropIfExists('progress');
    }
};
