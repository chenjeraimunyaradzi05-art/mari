<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('wellbeing_events', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('type');
            $table->string('mode')->default('in_person');
            $table->string('location_region')->nullable();
            $table->string('location_venue')->nullable();
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->string('organiser_name')->nullable();
            $table->string('sponsor_name')->nullable();
            $table->boolean('women_only')->default(true);
            $table->string('intensity')->nullable();
            $table->text('summary')->nullable();
            $table->string('registration_url')->nullable();
            $table->json('interest_tags')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wellbeing_events');
    }
};
