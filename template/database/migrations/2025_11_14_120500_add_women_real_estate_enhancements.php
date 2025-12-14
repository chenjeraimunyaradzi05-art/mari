<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ai_inference_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('pipeline');
            $table->string('provider')->nullable();
            $table->string('prompt_version')->nullable();
            $table->string('prompt_hash', 64);
            $table->unsignedInteger('tokens_in')->default(0);
            $table->unsignedInteger('tokens_out')->default(0);
            $table->unsignedInteger('duration_ms')->nullable();
            $table->decimal('confidence', 4, 2)->nullable();
            $table->string('result_status')->default('success');
            $table->boolean('cache_hit')->default(false);
            $table->boolean('override_flag')->default(false);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['pipeline', 'created_at']);
            $table->index(['provider', 'created_at']);
            $table->index(['result_status']);
        });

        Schema::create('women_agent_verification_audits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('agent_id')->constrained('women_verified_agents')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status_before')->nullable();
            $table->string('status_after');
            $table->json('notes')->nullable();
            $table->json('ai_summary')->nullable();
            $table->timestamps();

            $table->index(['agent_id', 'created_at']);
            $table->index(['reviewer_id', 'created_at']);
        });

        Schema::table('women_verified_agents', function (Blueprint $table): void {
            $table->string('verification_stage')->default('initial')->after('status');
            $table->unsignedTinyInteger('trust_badge_level')->default(0)->after('verification_stage');
            $table->decimal('compliance_score', 5, 2)->nullable()->after('trust_badge_level');
            $table->timestamp('last_reviewed_at')->nullable()->after('verified_at');

            $table->index(['status', 'verification_stage']);
        });

        Schema::table('women_listings', function (Blueprint $table): void {
            $table->decimal('trust_score', 5, 2)->nullable()->after('is_verified');
            $table->decimal('market_score', 5, 2)->nullable()->after('trust_score');
            $table->boolean('published_via_social')->default(false)->after('market_score');
            $table->timestamp('social_boosted_at')->nullable()->after('published_via_social');
        });
    }

    public function down(): void
    {
        Schema::table('women_listings', function (Blueprint $table): void {
            $table->dropColumn(['trust_score', 'market_score', 'published_via_social', 'social_boosted_at']);
        });

        Schema::table('women_verified_agents', function (Blueprint $table): void {
            $table->dropIndex('women_verified_agents_status_verification_stage_index');
            $table->dropColumn(['verification_stage', 'trust_badge_level', 'compliance_score', 'last_reviewed_at']);
        });

        Schema::dropIfExists('women_agent_verification_audits');
        Schema::dropIfExists('ai_inference_logs');
    }
};
