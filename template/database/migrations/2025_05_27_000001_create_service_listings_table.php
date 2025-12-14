<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $hasOrganizationPages = Schema::hasTable('organization_pages');

        Schema::create('service_listings', function (Blueprint $table) use ($hasOrganizationPages) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name');
            $table->string('slug')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            if ($hasOrganizationPages) {
                $table->foreignId('org_page_id')->nullable()->constrained('organization_pages')->nullOnDelete();
            } else {
                $table->unsignedBigInteger('org_page_id')->nullable()->index();
            }
            $table->string('category');
            $table->string('city')->nullable();
            $table->string('state', 8)->nullable();
            $table->string('country', 3)->default('AU');
            $table->string('location_slug')->nullable()->index();
            $table->text('description')->nullable();
            $table->json('modalities')->nullable();
            $table->json('availability_options')->nullable();
            $table->json('perks')->nullable();
            $table->json('tags')->nullable();
            $table->string('hero_image')->nullable();
            $table->string('price_tier')->nullable();
            $table->string('price_copy')->nullable();
            $table->string('booking_cta')->nullable();
            $table->decimal('rating', 3, 2)->nullable();
            $table->unsignedInteger('review_count')->default(0);
            $table->boolean('is_sponsored')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('featured_until')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_listings');
    }
};
