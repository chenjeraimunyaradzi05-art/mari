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
        if (!Schema::hasTable('groups')) {
            Schema::create('groups', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->longText('description')->nullable();
                $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
                $table->string('avatar')->nullable();
                $table->boolean('is_public')->default(true);
                $table->integer('members_count')->default(1);
                $table->timestamps();
                $table->softDeletes();

                // Indexes
                $table->index('created_by');
                $table->index('is_public');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('groups');
    }
};
