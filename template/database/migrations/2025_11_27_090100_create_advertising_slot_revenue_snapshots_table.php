<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('advertising_slot_revenue_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('slot_id')->nullable()->constrained('advertising_slots')->nullOnDelete();
            $table->string('slot_key', 120);
            $table->date('report_date');
            $table->unsignedBigInteger('impressions')->default(0);
            $table->unsignedBigInteger('clicks')->default(0);
            $table->unsignedBigInteger('conversions')->default(0);
            $table->unsignedBigInteger('spend_cents')->default(0);
            $table->decimal('pipeline_value', 15, 2)->default(0);
            $table->unsignedInteger('partner_count')->default(0);
            $table->json('notes')->nullable();
            $table->timestamps();

            $table->unique(['slot_key', 'report_date']);
            $table->index('report_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('advertising_slot_revenue_snapshots');
    }
};
