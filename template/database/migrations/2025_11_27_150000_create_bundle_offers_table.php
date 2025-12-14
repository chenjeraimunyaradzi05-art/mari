<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('bundle_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('bundle_code')->unique();
            $table->string('status')->default('draft');
            $table->string('currency', 3)->default('AUD');
            $table->decimal('baseline_monthly_cost', 12, 2)->default(0);
            $table->decimal('projected_monthly_cost', 12, 2)->default(0);
            $table->decimal('projected_savings_monthly', 12, 2)->default(0);
            $table->decimal('projected_savings_annual', 12, 2)->default(0);
            $table->decimal('confidence', 5, 2)->default(0.50);
            $table->json('recommendations')->nullable();
            $table->json('impact_projection')->nullable();
            $table->json('success_tracking')->nullable();
            $table->text('negotiation_script')->nullable();
            $table->string('referral_code')->nullable();
            $table->json('provider_payload')->nullable();
            $table->timestamp('referred_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['status']);
        });

        Schema::create('bundle_offer_line_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_offer_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            $table->string('current_provider')->nullable();
            $table->decimal('current_monthly_cost', 12, 2)->default(0);
            $table->string('suggested_provider')->nullable();
            $table->decimal('suggested_monthly_cost', 12, 2)->default(0);
            $table->decimal('projected_savings_monthly', 12, 2)->default(0);
            $table->string('provider_connector')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bundle_offer_line_items');
        Schema::dropIfExists('bundle_offers');
    }
};
