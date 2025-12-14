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
        Schema::create('vertical_insights', function (Blueprint $table) {
            $table->id();
            $table->string('vertical_slug')->unique();
            $table->string('vertical_name');
            $table->unsignedInteger('open_roles')->default(0);
            $table->unsignedInteger('courses')->default(0);
            $table->unsignedInteger('mentors')->default(0);
            $table->json('meta')->nullable();
            $table->timestamp('refreshed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vertical_insights');
    }
};
