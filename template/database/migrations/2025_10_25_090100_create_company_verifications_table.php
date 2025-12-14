<?php

use App\Enums\CompanyVerificationStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('company_verifications')) {
            return;
        }

        Schema::create('company_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('status', 50)->default(CompanyVerificationStatus::Pending->value);
            $table->foreignId('reviewer_id')->nullable()->constrained('admins')->nullOnDelete();
            $table->json('documents')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('evidence_path')->nullable();
            $table->string('source', 50)->default('dashboard');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index(['company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_verifications');
    }
};
