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
        if (!Schema::hasTable('pronouns')) {
            Schema::create('pronouns', function (Blueprint $table) {
                $table->id();
                $table->string('name'); // e.g., "she/her", "they/them"
                $table->string('display_name')->nullable(); // e.g., "She/Her/Hers"
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pronouns');
    }
};
