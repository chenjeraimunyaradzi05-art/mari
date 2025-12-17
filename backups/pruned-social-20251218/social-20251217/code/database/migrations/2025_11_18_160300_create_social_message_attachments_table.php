<?php

use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_message_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_message_id')->constrained('social_messages')->cascadeOnDelete();
            $table->foreignIdFor(SocialProfile::class, 'uploaded_by_social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('media_type', 32);
            $table->string('storage_disk')->nullable();
            $table->string('file_path');
            $table->string('thumbnail_path')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->integer('width')->nullable();
            $table->integer('height')->nullable();
            $table->integer('duration')->nullable();
            $table->string('mediaable_type')->nullable();
            $table->unsignedBigInteger('mediaable_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index('mediaable_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_message_attachments');
    }
};
