<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('dealers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('license_number')->nullable(); // AFSL or Dealer License
            $table->string('address')->nullable();
            $table->string('contact_email');
            $table->string('contact_phone')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->string('logo_url')->nullable();
            $table->timestamps();
        });

        Schema::create('vehicle_listings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dealer_id')->constrained()->onDelete('cascade');
            $table->string('title'); // e.g. 2020 Toyota Corolla
            $table->string('slug')->unique();
            $table->string('make');
            $table->string('model');
            $table->integer('year');
            $table->string('type'); // SUV, Sedan, Hatchback
            $table->string('transmission'); // Automatic, Manual
            $table->string('fuel_type'); // Petrol, Hybrid, Electric
            $table->integer('price_cents');
            $table->integer('odometer_km');
            $table->text('description')->nullable();
            $table->json('features')->nullable(); // Bluetooth, Reverse Camera, etc.
            $table->json('images')->nullable();
            $table->string('status')->default('active'); // active, sold, pending
            $table->boolean('is_featured')->default(false);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('vehicle_listings');
        Schema::dropIfExists('dealers');
    }
};
