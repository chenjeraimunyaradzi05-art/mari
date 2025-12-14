<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tafe_program_intakes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tafe_program_id')->constrained('tafe_programs')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('intake_name');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->date('application_deadline')->nullable();
            $table->boolean('is_virtual')->default(false);
            $table->unsignedSmallInteger('seats_available')->nullable();
            $table->json('location')->nullable();
            $table->decimal('ai_demand_index', 5, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tafe_program_id', 'start_date']);
            $table->index('application_deadline');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tafe_program_intakes');
    }
};
