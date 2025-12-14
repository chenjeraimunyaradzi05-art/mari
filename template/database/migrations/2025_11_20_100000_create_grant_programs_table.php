<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('grant_programs', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('provider_name');
            $table->string('provider_type');
            $table->string('location_restriction')->nullable();
            $table->unsignedBigInteger('max_amount_cents')->nullable();
            $table->string('currency', 3)->default('AUD');
            $table->date('opens_at')->nullable();
            $table->date('closes_at')->nullable();
            $table->date('decision_at')->nullable();
            $table->string('application_url')->nullable();
            $table->text('description')->nullable();
            $table->json('required_documents')->nullable();
            $table->json('eligibility_requirements')->nullable();
            $table->json('tags')->nullable();
            $table->unsignedTinyInteger('match_score')->nullable();
            $table->json('missing_criteria')->nullable();
            $table->json('states')->nullable();
            $table->timestamps();

            $table->index('provider_type');
            $table->index('closes_at');
            $table->index('match_score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grant_programs');
    }
};
