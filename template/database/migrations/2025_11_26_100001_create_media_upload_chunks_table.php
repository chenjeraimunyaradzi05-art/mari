<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('media_upload_chunks')) {
            return;
        }

        Schema::create('media_upload_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('media_upload_session_id')->constrained('media_upload_sessions')->cascadeOnDelete();
            $table->unsignedInteger('chunk_index');
            $table->unsignedInteger('size')->default(0);
            $table->string('checksum', 190)->nullable();
            $table->string('storage_path', 512);
            $table->timestamp('uploaded_at')->nullable();
            $table->timestamps();

            $table->unique(['media_upload_session_id', 'chunk_index'], 'media_upload_chunks_session_index_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_upload_chunks');
    }
};
