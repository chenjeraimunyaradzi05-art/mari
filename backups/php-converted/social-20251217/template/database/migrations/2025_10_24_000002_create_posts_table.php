<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up() {
        if (!Schema::hasTable('posts')) {
            Schema::create('posts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->text('content');
                $table->string('media')->nullable();
                $table->string('type')->nullable();
                $table->string('visibility')->default('public');
                $table->timestamps();
            });
        }
    }
    public function down() {
        Schema::dropIfExists('posts');
    }
};
