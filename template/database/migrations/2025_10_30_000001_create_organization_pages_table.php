<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		if (!Schema::hasTable('organization_pages')) {
			Schema::create('organization_pages', function (Blueprint $table) {
				$table->id();
				$table->foreignId('company_id')->nullable()->constrained('companies')->nullOnDelete();
				$table->enum('type', ['university','tafe','rto','employer','tradie','government','association'])->index();
				$table->string('slug')->unique();
				$table->string('name');
				$table->string('tagline')->nullable();
				$table->text('about')->nullable();
				$table->text('mission')->nullable();
				$table->json('declaration')->nullable();
				$table->json('safety_commitments')->nullable();
				$table->json('highlights')->nullable();
				$table->json('policies')->nullable();
				$table->unsignedBigInteger('cover_media_id')->nullable()->index();
				$table->string('hero_cta_label')->nullable();
				$table->string('hero_cta_url')->nullable();
				$table->string('website_url')->nullable();
				$table->string('contact_email')->nullable();
				$table->string('contact_phone')->nullable();
				$table->enum('verification_status', ['unverified','pending','verified'])->default('unverified')->index();
				$table->unsignedTinyInteger('safety_score')->default(0);
				$table->enum('profile_status', ['draft','published','archived'])->default('draft')->index();
				$table->timestamp('published_at')->nullable();
				$table->timestamps();
				$table->softDeletes();
				if (Schema::getConnection()->getDriverName() === 'mysql') {
					$table->fullText(['name','tagline','about']);
				}
			});
		}
	}

	public function down(): void
	{
		Schema::dropIfExists('organization_pages');
	}
};
