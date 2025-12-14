<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::create('courses', function (Blueprint $table) {
			$table->id();
			$table->foreignId('provider_org_page_id')->constrained('organization_pages')->cascadeOnDelete();
			$table->string('code')->nullable()->index();
			$table->string('title');
			$table->string('slug')->nullable()->unique();
			$table->text('summary')->nullable();
			$table->enum('type', ['bachelor','masters','micro','tafe_cert','tafe_diploma','short','apprenticeship'])->index();
			$table->enum('mode', ['on_campus','online','hybrid'])->index();
			$table->json('delivery_options')->nullable();
			$table->string('location')->nullable();
			$table->unsignedInteger('duration_weeks')->nullable();
			$table->unsignedBigInteger('cost_cents')->nullable();
			$table->json('funding')->nullable();
			$table->json('prerequisites')->nullable();
			$table->json('outcomes')->nullable();
			$table->json('tags')->nullable();
			$table->string('application_url')->nullable();
			$table->string('contact_email')->nullable();
			$table->string('contact_phone')->nullable();
			$table->enum('status', ['draft','published','archived'])->default('draft')->index();
			$table->timestamp('published_at')->nullable();
			$table->timestamps();
			$table->softDeletes();

			$table->index(['provider_org_page_id', 'status']);
			if (Schema::getConnection()->getDriverName() === 'mysql') {
				$table->fullText(['title', 'summary']);
			}
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('courses');
	}
};
