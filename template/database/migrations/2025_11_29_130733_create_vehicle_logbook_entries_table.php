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
        Schema::create('vehicle_logbook_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_logbook_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->integer('odometer_start');
            $table->integer('odometer_end');
            $table->integer('distance'); // Calculated or entered
            $table->string('purpose'); // e.g., "Client meeting", "Site visit"
            $table->string('start_location')->nullable();
            $table->string('end_location')->nullable();
            $table->boolean('business_use')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vehicle_logbook_entries');
    }
};
