<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('listing_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('housing_listing_id')->constrained('housing_listings')->cascadeOnDelete();
            $table->string('storage_path');
            $table->string('cdn_url')->nullable();
            $table->string('caption')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_primary')->default(false);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['housing_listing_id', 'position']);
            $table->index(['housing_listing_id', 'is_primary']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_photos');
    }
};
