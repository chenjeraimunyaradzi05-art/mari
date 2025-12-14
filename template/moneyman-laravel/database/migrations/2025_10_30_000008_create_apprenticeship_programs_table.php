<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('apprenticeship_programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
            $table->string('framework')->nullable();
            $table->string('level')->nullable();
            $table->string('rto_code')->nullable();
            $table->json('competencies')->nullable();
            $table->timestamps();
            $table->index(['org_page_id','rto_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('apprenticeship_programs');
    }
};
