<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tafe_student_journeys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('tafe_program_id')->constrained('tafe_programs')->cascadeOnUpdate()->cascadeOnDelete();
            $table->enum('status', [
                'exploring',
                'applied',
                'interviewing',
                'accepted',
                'enrolled',
                'graduated',
                'on_hold',
            ])->default('exploring');
            $table->decimal('ai_success_probability', 5, 2)->default(0);
            $table->json('ai_recommended_actions')->nullable();
            $table->string('next_action')->nullable();
            $table->timestamp('next_action_due_at')->nullable();
            $table->text('motivation_note')->nullable();
            $table->unsignedBigInteger('last_synced_post_id')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('enrolled_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'tafe_program_id']);
            $table->index(['status', 'next_action_due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tafe_student_journeys');
    }
};
