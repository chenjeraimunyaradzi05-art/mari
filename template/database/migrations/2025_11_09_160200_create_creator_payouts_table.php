<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('creator_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedBigInteger('impressions')->default(0);
            $table->decimal('payout_amount', 10, 2)->default(0);
            $table->decimal('cpm', 8, 2)->nullable();
            $table->string('currency', 3)->default('AUD');
            $table->string('status', 30)->default('pending');
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'period_start', 'period_end']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('creator_payouts');
    }
};
