<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $hasLeadTable = Schema::hasTable('leads');

        Schema::create('service_listing_leads', function (Blueprint $table) use ($hasLeadTable) {
            $table->id();
            $table->foreignId('service_listing_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            if ($hasLeadTable) {
                $table->foreignId('lead_id')->nullable()->constrained('leads')->nullOnDelete();
            } else {
                $table->unsignedBigInteger('lead_id')->nullable()->index();
            }
            $table->string('contact_name')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone')->nullable();
            $table->string('source')->default('women_marketplace');
            $table->string('status')->default('new');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_listing_leads');
    }
};
