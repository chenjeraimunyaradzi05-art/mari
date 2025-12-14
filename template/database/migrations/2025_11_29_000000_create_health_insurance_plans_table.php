<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('health_insurance_plans', function (Blueprint $table) {
            $table->id();
            $table->string('provider_name');
            $table->string('plan_name');
            $table->decimal('monthly_premium', 10, 2);
            $table->decimal('deductible', 10, 2);
            $table->decimal('out_of_pocket_max', 10, 2);
            $table->string('coverage_type'); // e.g., HMO, PPO, EPO
            $table->json('features')->nullable();
            $table->decimal('rating', 3, 1)->nullable();
            $table->string('website_url')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('health_insurance_plans');
    }
};
