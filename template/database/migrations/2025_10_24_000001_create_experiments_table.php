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
        Schema::create('experiments', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            $table->string('status')->default('active'); // active, paused, completed
            $table->json('variants'); // ['control', 'variant_a', 'variant_b']
            $table->json('weights')->nullable(); // {'control': 50, 'variant_a': 50}
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
        });

        Schema::create('experiment_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('experiment_id')->constrained()->onDelete('cascade');
            $table->string('visitor_id')->index(); // Cookie ID or User ID
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->string('variant');
            $table->timestamps();

            $table->unique(['experiment_id', 'visitor_id']);
        });

        Schema::create('experiment_conversions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('experiment_id')->constrained()->onDelete('cascade');
            $table->string('visitor_id')->index();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->string('conversion_event'); // e.g., 'signup', 'purchase'
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('experiment_conversions');
        Schema::dropIfExists('experiment_assignments');
        Schema::dropIfExists('experiments');
    }
};
