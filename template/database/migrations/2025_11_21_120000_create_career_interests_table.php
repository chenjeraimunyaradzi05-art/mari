<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('career_interests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('pathway_type', [
                'job',
                'apprenticeship',
                'traineeship',
                'trade',
                'tafe_course',
                'university_course',
                'public_sector',
                'other',
            ]);
            $table->string('title')->nullable();
            $table->string('field')->nullable();
            $table->string('industry')->nullable();
            $table->string('level')->nullable();
            $table->string('preferred_location')->nullable();
            $table->boolean('open_to_remote')->default(false);
            $table->unsignedInteger('min_pay_annual')->nullable();
            $table->unsignedInteger('max_pay_annual')->nullable();
            $table->string('timeline')->nullable();
            $table->text('skills')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['active', 'paused', 'fulfilled'])->default('active');
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['pathway_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('career_interests');
    }
};
