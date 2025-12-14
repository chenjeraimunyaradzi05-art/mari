<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('real_estate_learning_paths', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('path_type', 40);
            $table->string('difficulty_level', 24);
            $table->unsignedTinyInteger('duration_weeks')->nullable();
            $table->json('modules')->nullable();
            $table->json('associated_courses')->nullable();
            $table->boolean('ai_guided')->default(true);
            $table->json('outcomes')->nullable();
            $table->text('summary')->nullable();
            $table->timestamps();

            $table->index(['path_type', 'difficulty_level'], 'real_estate_learning_paths_type_level_idx');
            $table->index('ai_guided');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('real_estate_learning_paths');
    }
};
