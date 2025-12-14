<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('media_upload_sessions')) {
            return;
        }

        Schema::create('media_upload_sessions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 40)->default('pending');
            $table->string('media_type', 40);
            $table->string('mime_type', 120)->nullable();
            $table->string('storage_disk', 60);
            $table->string('storage_path', 512)->nullable();
            $table->string('chunk_disk', 60);
            $table->unsignedBigInteger('total_size')->default(0);
            $table->unsignedBigInteger('uploaded_size')->default(0);
            $table->unsignedInteger('chunk_size')->default(0);
            $table->unsignedInteger('total_chunks')->default(0);
            $table->unsignedInteger('received_chunks')->default(0);
            $table->string('checksum', 190)->nullable();
            $table->string('role_quota_key', 60)->nullable();
            $table->json('meta')->nullable();
            $table->string('thumbnail_path', 512)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('error_message', 500)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_upload_sessions');
    }
};
