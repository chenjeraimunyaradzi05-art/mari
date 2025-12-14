<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('wellbeing_partner_offers', function (Blueprint $table) {
            $table->id();
            $table->string('brand');
            $table->string('headline');
            $table->text('description')->nullable();
            $table->string('cta_label')->default('Explore offer');
            $table->string('cta_url');
            $table->string('discount_code')->nullable();
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->json('interest_tags')->nullable();
            $table->unsignedInteger('priority')->default(0);
            $table->boolean('requires_membership')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wellbeing_partner_offers');
    }
};
