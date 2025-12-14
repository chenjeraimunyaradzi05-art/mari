<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
            $table->enum('type', ['course','apprenticeship','job','general'])->index();
            $table->json('payload');
            $table->string('source')->nullable();
            $table->string('status')->default('new')->index();
            $table->unsignedBigInteger('assigned_to')->nullable()->index();
            $table->json('utm')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
