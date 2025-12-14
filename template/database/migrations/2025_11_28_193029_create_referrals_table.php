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
        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('referred_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('referral_code')->unique();
            $table->string('referred_email')->nullable();
            $table->enum('status', ['pending', 'accepted', 'rewarded'])->default('pending');
            $table->timestamp('referred_at')->nullable();
            $table->timestamp('rewarded_at')->nullable();
            $table->decimal('reward_amount', 10, 2)->nullable();
            $table->timestamps();

            $table->index('referral_code');
            $table->index(['referrer_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('referrals');
    }
};
