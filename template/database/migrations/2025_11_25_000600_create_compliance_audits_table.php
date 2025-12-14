<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('compliance_audits')) {
            return;
        }

        Schema::create('compliance_audits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->nullableMorphs('auditable');
            $table->string('action');
            $table->json('meta')->nullable();
            $table->string('actor_ip', 45)->nullable();
            $table->string('actor_user_agent')->nullable();
            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamps();

            $table->index(['auditable_type', 'auditable_id'], 'compliance_audits_auditable_index');
            $table->index('recorded_at', 'compliance_audits_recorded_at_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compliance_audits');
    }
};
