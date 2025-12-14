<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('business_resources', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('resource_type')->default('playbook');
            $table->string('badge')->nullable();
            $table->text('summary')->nullable();
            $table->string('cta_label')->nullable();
            $table->string('cta_url')->nullable();
            $table->string('hero_color')->nullable();
            $table->json('tags')->nullable();
            $table->json('metadata')->nullable();
            $table->float('ai_relevance_score')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_resources');
    }
};
