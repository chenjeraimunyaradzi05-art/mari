<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('organization_pages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('org_id')->nullable()->index();
            $table->enum('type', ['university','tafe','rto','employer','tradie','government','association'])->index();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('tagline')->nullable();
            $table->unsignedBigInteger('cover_media_id')->nullable();
            $table->enum('verification_status', ['unverified','pending','verified'])->default('unverified')->index();
            $table->unsignedTinyInteger('safety_score')->default(0);
            $table->timestamps();
            $table->fullText(['name','tagline']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_pages');
    }
};
