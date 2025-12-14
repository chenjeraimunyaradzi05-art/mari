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
        if (!Schema::hasTable('saved_searches')) {
            Schema::create('saved_searches', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->string('user_type');
                $table->string('name');
                $table->string('search_type');
                $table->json('filters');
                $table->integer('alert_frequency')->nullable();
                $table->timestamp('last_alerted_at')->nullable();
                $table->timestamps();
                $table->index(['user_id', 'user_type']);
                $table->index('search_type');
            });
        }

        if (!Schema::hasTable('search_history')) {
            Schema::create('search_history', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained()->onDelete('cascade');
                $table->string('query');
                $table->string('search_type');
                $table->integer('results_count')->default(0);
                $table->json('filters')->nullable();
                $table->ipAddress('ip_address')->nullable();
                $table->string('user_agent')->nullable();
                $table->timestamp('created_at');
                $table->index(['user_id', 'created_at']);
                $table->index('search_type');
                $table->index('created_at');
            });
        }

        if (!Schema::hasTable('search_suggestions')) {
            Schema::create('search_suggestions', function (Blueprint $table) {
                $table->id();
                $table->string('term');
                $table->string('suggestion_type');
                $table->integer('popularity')->default(0);
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->index(['term', 'suggestion_type']);
                $table->index('popularity');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('search_suggestions');
        Schema::dropIfExists('search_history');
        Schema::dropIfExists('saved_searches');
    }
};
