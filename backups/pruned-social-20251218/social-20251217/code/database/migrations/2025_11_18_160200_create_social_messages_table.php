<?php

use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_thread_id')->constrained('social_threads')->cascadeOnDelete();
            $table->foreignIdFor(SocialProfile::class, 'sender_social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('message_type', 32)->default('text');
            $table->string('status', 32)->default('sent');
            $table->text('body')->nullable();
            $table->json('structured_body')->nullable();
            $table->string('shareable_type')->nullable();
            $table->unsignedBigInteger('shareable_id')->nullable();
            $table->foreignId('reply_to_message_id')->nullable()->constrained('social_messages')->nullOnDelete();
            $table->foreignId('template_id')->nullable()->constrained('social_message_templates')->nullOnDelete();
            $table->boolean('is_system')->default(false);
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('edited_at')->nullable();
            $table->decimal('spam_score', 5, 2)->default(0);
            $table->json('moderation_flags')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['social_thread_id', 'sent_at']);
        });

        Schema::table('social_threads', function (Blueprint $table) {
            $table->foreign('last_message_id')->references('id')->on('social_messages')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('social_threads', function (Blueprint $table) {
            $table->dropForeign(['last_message_id']);
        });

        Schema::dropIfExists('social_messages');
    }
};
