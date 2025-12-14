<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('wellness_buddy_invites');

        Schema::create('wellness_buddy_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_profile_id')->constrained('profiles')->cascadeOnDelete();
            $table->foreignId('target_profile_id')->constrained('profiles')->cascadeOnDelete();
            $table->string('activity_type')->nullable();
            $table->string('location_preference')->nullable();
            $table->json('preferred_schedule')->nullable();
            $table->json('comfort_preferences')->nullable();
            $table->enum('status', ['pending', 'accepted', 'declined', 'withdrawn'])->default('pending');
            $table->text('intro_message')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->unique(['requester_profile_id', 'target_profile_id'], 'wb_invites_requester_target_unique');
            $table->index(['target_profile_id', 'status'], 'wb_invites_target_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wellness_buddy_invites');
    }
};
