<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('women_listing_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('women_housing_listing_id')->constrained('women_housing_listings')->cascadeOnDelete();
            $table->string('storage_path');
            $table->string('cdn_url')->nullable();
            $table->string('caption')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_primary')->default(false);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['women_housing_listing_id', 'position']);
            $table->index(['women_housing_listing_id', 'is_primary']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_listing_photos');
    }
};
