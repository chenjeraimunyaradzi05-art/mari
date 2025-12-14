<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('scope', 32)->default('personal');
            $table->string('label')->nullable();
            $table->string('currency', 8)->default('AUD');
            $table->unsignedInteger('savings_goal_monthly')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'scope']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budgets');
    }
};
