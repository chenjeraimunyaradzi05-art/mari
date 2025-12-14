<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('public_sector_programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('public_sector_agency_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('program_type')->default('funding');
            $table->string('delivery_mode')->nullable();
            $table->string('application_status')->default('open');
            $table->date('next_intake_date')->nullable();
            $table->string('application_url')->nullable();
            $table->json('support_channels')->nullable();
            $table->json('tags')->nullable();
            $table->text('summary')->nullable();
            $table->text('eligibility')->nullable();
            $table->text('ai_recommendation')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_sector_programs');
    }
};
