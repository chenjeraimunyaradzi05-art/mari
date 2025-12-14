<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_org_page_id')->constrained('organization_pages')->cascadeOnDelete();
            $table->string('code')->nullable();
            $table->string('title');
            $table->enum('type', ['bachelor','masters','micro','tafe_cert','tafe_diploma','short','apprenticeship'])->index();
            $table->enum('mode', ['on_campus','online','hybrid'])->index();
            $table->string('location')->nullable();
            $table->unsignedInteger('duration_weeks')->nullable();
            $table->unsignedBigInteger('cost_cents')->nullable();
            $table->json('funding')->nullable();
            $table->json('prerequisites')->nullable();
            $table->json('outcomes')->nullable();
            $table->json('tags')->nullable();
            $table->timestamps();
            $table->fullText(['title']);
            $table->index(['provider_org_page_id','type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courses');
    }
};
