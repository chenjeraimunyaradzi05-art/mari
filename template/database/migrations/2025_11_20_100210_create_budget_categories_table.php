<?php

declare(strict_types=1);

use App\Models\BudgetProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('budget_categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignIdFor(BudgetProfile::class)->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('frequency')->default('monthly');
            $table->unsignedBigInteger('planned_amount_cents')->default(0);
            $table->unsignedBigInteger('actual_amount_cents')->default(0);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_categories');
    }
};
