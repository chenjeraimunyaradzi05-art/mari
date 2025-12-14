<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('course_intakes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->date('start_on');
            $table->date('apply_by')->nullable();
            $table->unsignedInteger('seats')->nullable();
            $table->json('scholarships')->nullable();
            $table->timestamps();
            $table->index(['course_id','start_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_intakes');
    }
};
