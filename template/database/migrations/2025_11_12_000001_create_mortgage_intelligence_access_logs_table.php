<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('mortgage_intelligence_access_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('women_housing_listing_id');
            $table->string('channel', 32);
            $table->json('meta')->nullable();
            $table->timestamp('accessed_at');
            $table->timestamps();

            $table->foreign('women_housing_listing_id', 'mia_logs_listing_fk')
                ->references('id')
                ->on('women_housing_listings')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mortgage_intelligence_access_logs');
    }
};
