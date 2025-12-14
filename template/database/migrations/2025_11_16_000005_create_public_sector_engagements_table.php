<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('public_sector_engagements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('public_sector_opportunity_id')->nullable()->constrained()->nullOnDelete();
            $table->string('engagement_type')->default('interest');
            $table->json('channels')->nullable();
            $table->text('motivation')->nullable();
            $table->text('ai_summary')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_sector_engagements');
    }
};
