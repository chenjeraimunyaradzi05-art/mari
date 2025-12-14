<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up() {
        if (!Schema::hasTable('groups')) {
            Schema::create('groups', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('type')->nullable();
                $table->unsignedBigInteger('created_by');
                $table->string('visibility')->default('public');
                $table->timestamps();
            });
        }
    }
    public function down() {
        Schema::dropIfExists('groups');
    }
};
