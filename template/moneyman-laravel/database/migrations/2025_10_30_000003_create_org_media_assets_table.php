<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('org_media_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
            $table->enum('type', ['video','image'])->index();
            $table->string('storage_path');
            $table->integer('duration')->nullable();
            $table->string('captions_path')->nullable();
            $table->json('safety_labels')->nullable();
            $table->enum('status', ['uploaded','processing','ready','rejected'])->default('uploaded')->index();
            $table->timestamps();
            $table->index(['org_page_id','status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('org_media_assets');
    }
};
