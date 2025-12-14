<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('public_sector_insights', function (Blueprint $table) {
            $table->id();
            $table->string('insight_type');
            $table->string('metric_label');
            $table->string('metric_value');
            $table->string('change_label')->nullable();
            $table->decimal('change_percent', 5, 2)->nullable();
            $table->enum('trend', ['up', 'down', 'flat'])->default('flat');
            $table->text('summary')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_sector_insights');
    }
};
