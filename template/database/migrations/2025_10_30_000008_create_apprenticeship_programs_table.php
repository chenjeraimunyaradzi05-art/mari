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
			$table->string('title');
			$table->text('summary')->nullable();
			$table->json('requirements')->nullable();
			$table->string('location')->nullable();
			$table->unsignedInteger('duration_weeks')->nullable();
			$table->string('application_url')->nullable();
			$table->enum('status', ['draft','published','archived'])->default('draft')->index();
			$table->json('meta')->nullable();
			$table->timestamp('published_at')->nullable();
			$table->timestamps();
			$table->softDeletes();

			$table->index(['org_page_id', 'status']);
			if (Schema::getConnection()->getDriverName() === 'mysql') {
				$table->fullText(['title', 'summary']);
			}
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('apprenticeship_programs');
	}
};
