<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversation_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignId('sender_profile_id')->constrained('profiles')->cascadeOnDelete();
            $table->enum('message_type', ['text', 'media', 'post_share', 'system'])->default('text');
            $table->text('body')->nullable();
            $table->json('attachments')->nullable();
            $table->string('shareable_type')->nullable();
            $table->unsignedBigInteger('shareable_id')->nullable();
            $table->boolean('is_system')->default(false);
            $table->timestamp('sent_at')->nullable()->useCurrent();
            $table->timestamps();

            $table->index(['conversation_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_messages');
    }
};
