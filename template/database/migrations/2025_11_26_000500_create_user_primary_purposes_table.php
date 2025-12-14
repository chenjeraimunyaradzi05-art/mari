<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_primary_purposes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('primary_purpose');
            $table->json('secondary_intents')->nullable();
            $table->json('feature_flags')->nullable();
            $table->string('identity_alignment')->default('woman_identifying');
            $table->text('purpose_story')->nullable();
            $table->text('male_signal_notes')->nullable();
            $table->unsignedTinyInteger('completion_step')->default(1);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['primary_purpose']);
            $table->index(['identity_alignment']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_primary_purposes');
    }
};
