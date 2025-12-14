<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up() {
        if (!Schema::hasTable('group_members')) {
            Schema::create('group_members', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('group_id');
                $table->unsignedBigInteger('user_id');
                $table->string('role')->default('member'); // admin, moderator, member
                $table->timestamp('joined_at')->nullable();
                $table->timestamps();

                $table->foreign('group_id')->references('id')->on('groups')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->unique(['group_id', 'user_id']);
                $table->index('user_id');
            });
        }
    }

    public function down() {
        Schema::dropIfExists('group_members');
    }
};
