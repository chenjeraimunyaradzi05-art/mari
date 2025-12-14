<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('learning_path_enrolments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('real_estate_learning_path_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('enrolment_status', ['active', 'completed', 'dropped'])->default('active');
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('last_ai_check_in_at')->nullable();
            $table->timestamps();

            $table->unique([
                'real_estate_learning_path_id',
                'user_id',
            ], 'learning_path_enrolments_unique_path_user');

            $table->index('enrolment_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_path_enrolments');
    }
};
