<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('public_sector_opportunities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('public_sector_agency_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('public_sector_program_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('role_level')->nullable();
            $table->string('work_arrangement')->nullable();
            $table->string('location')->nullable();
            $table->string('salary_band')->nullable();
            $table->date('closes_at')->nullable();
            $table->string('application_url')->nullable();
            $table->json('tags')->nullable();
            $table->text('summary')->nullable();
            $table->text('impact_statement')->nullable();
            $table->text('ai_signal')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->unsignedTinyInteger('priority_score')->default(60);
            $table->string('status')->default('open');
            $table->timestamps();

            $table->index(['status', 'closes_at']);
            $table->index('is_featured');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_sector_opportunities');
    }
};
