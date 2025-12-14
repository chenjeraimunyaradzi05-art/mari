<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_profile_id')->constrained('profiles')->cascadeOnDelete();
            $table->foreignId('blocked_profile_id')->constrained('profiles')->cascadeOnDelete();
            $table->text('reason')->nullable();
            $table->timestamp('blocked_at')->useCurrent();
            $table->timestamps();

            $table->unique(['blocker_profile_id', 'blocked_profile_id']);
            $table->index('blocked_profile_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_blocks');
    }
};
