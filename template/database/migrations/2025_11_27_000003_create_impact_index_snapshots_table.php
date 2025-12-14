<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('impact_index_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('timeframe');
            $table->date('snapshot_date');
            $table->json('metrics');
            $table->boolean('is_public')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['timeframe', 'snapshot_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('impact_index_snapshots');
    }
};
