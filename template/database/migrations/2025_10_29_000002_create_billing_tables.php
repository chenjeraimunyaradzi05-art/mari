<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('billing_meters')) {
            Schema::create('billing_meters', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('event_type', 64);
                $table->foreignId('job_id')->nullable()->constrained('jobs')->nullOnDelete();
                $table->foreignId('candidate_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('applied_job_id')->nullable()->constrained('applied_jobs')->nullOnDelete();
                $table->boolean('eligible')->default(true);
                $table->timestamp('occurred_at');
                $table->json('meta')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'event_type', 'occurred_at'], 'billing_meters_company_event_idx');
                $table->index(['job_id', 'candidate_user_id'], 'billing_meters_job_candidate_idx');
            });
        }

        if (!Schema::hasTable('billing_charges')) {
            Schema::create('billing_charges', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->foreignId('meter_id')->nullable()->constrained('billing_meters')->nullOnDelete();
                $table->string('charge_type', 40);
                $table->integer('amount_cents')->default(0);
                $table->string('currency', 3)->default('AUD');
                $table->string('status', 32)->default('pending');
                $table->timestamp('billed_at')->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'status'], 'billing_charges_company_status_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_charges');
        Schema::dropIfExists('billing_meters');
    }
};
