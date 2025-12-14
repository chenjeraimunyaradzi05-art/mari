<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tafe_programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tafe_institution_id')->constrained('tafe_institutions')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->enum('credential_level', [
                'certificate_i',
                'certificate_ii',
                'certificate_iii',
                'certificate_iv',
                'diploma',
                'advanced_diploma',
                'associate_degree',
                'bachelor',
                'graduate_certificate',
                'graduate_diploma',
                'masters',
                'micro_credential',
                'bootcamp',
            ])->default('certificate_iii');
            $table->enum('delivery_mode', ['on_campus', 'online', 'hybrid'])->default('hybrid');
            $table->unsignedSmallInteger('duration_weeks')->nullable();
            $table->unsignedTinyInteger('weekly_commitment_hours')->nullable();
            $table->unsignedInteger('tuition_from_aud')->nullable();
            $table->unsignedInteger('tuition_to_aud')->nullable();
            $table->json('funding_options')->nullable();
            $table->json('ai_match_traits')->nullable();
            $table->json('outcomes')->nullable();
            $table->json('support_services')->nullable();
            $table->json('tags')->nullable();
            $table->text('summary')->nullable();
            $table->text('ai_recommendation_snippet')->nullable();
            $table->string('cta_label')->nullable();
            $table->string('application_url')->nullable();
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->decimal('ai_match_score', 5, 2)->default(0);
            $table->timestamp('last_ai_sync_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tafe_institution_id', 'slug']);
            $table->index(['status', 'credential_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tafe_programs');
    }
};
