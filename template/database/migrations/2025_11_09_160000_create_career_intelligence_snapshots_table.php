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
        Schema::create('career_intelligence_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('trajectory_score', 5, 2)->nullable();
            $table->unsignedInteger('learning_hours')->nullable();
            $table->unsignedInteger('network_reach')->nullable();
            $table->decimal('content_influence', 6, 4)->nullable();
            $table->string('target_role', 150)->nullable();
            $table->text('summary')->nullable();
            $table->timestamp('captured_at')->useCurrent();
            $table->timestamps();

            $table->index(['user_id', 'captured_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('career_intelligence_snapshots');
    }
};
