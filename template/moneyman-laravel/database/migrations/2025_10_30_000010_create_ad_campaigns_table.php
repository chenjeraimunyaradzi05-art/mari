<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ad_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
            $table->enum('objective', ['reach','traffic','leads','applications'])->index();
            $table->unsignedBigInteger('budget_cents')->default(0);
            $table->date('start_on')->index();
            $table->date('end_on')->nullable()->index();
            $table->json('targeting')->nullable();
            $table->enum('status', ['draft','active','paused','completed'])->default('draft')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_campaigns');
    }
};
