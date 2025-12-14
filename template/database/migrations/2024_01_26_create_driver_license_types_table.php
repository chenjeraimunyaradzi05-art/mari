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
        if (!Schema::hasTable('driver_license_types')) {
            Schema::create('driver_license_types', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // e.g., "Class C (Car)", "Class LR (Light Rigid)"
            $table->string('code'); // e.g., "C", "LR", "MR", "HR", "HC", "MC"
            $table->text('description')->nullable();
            $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('driver_license_types');
    }
};
