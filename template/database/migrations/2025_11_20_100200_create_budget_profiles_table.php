<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('budget_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignIdFor(User::class)->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('profile_type')->default('sole_trader');
            $table->string('currency', 3)->default('AUD');
            $table->unsignedBigInteger('income_total_cents')->default(0);
            $table->unsignedBigInteger('expense_total_cents')->default(0);
            $table->integer('net_total_cents')->default(0);
            $table->decimal('net_trend_percent', 5, 2)->default(0);
            $table->unsignedTinyInteger('savings_percent')->default(0);
            $table->unsignedInteger('runway_weeks')->default(0);
            $table->date('break_even_date')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('profile_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_profiles');
    }
};
