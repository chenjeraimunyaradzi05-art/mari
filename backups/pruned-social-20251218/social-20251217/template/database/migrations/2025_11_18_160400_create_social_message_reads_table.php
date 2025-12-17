<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_message_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_message_id')->constrained('social_messages')->cascadeOnDelete();
            $table->foreignId('social_thread_participant_id')->constrained('social_thread_participants')->cascadeOnDelete();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->string('device')->nullable();
            $table->json('context')->nullable();
            $table->timestamps();

            $table->unique(['social_message_id', 'social_thread_participant_id'], 'sm_reads_message_participant_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_message_reads');
    }
};
