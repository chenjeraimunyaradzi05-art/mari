<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		if (!Schema::hasTable('org_media_assets')) {
			Schema::create('org_media_assets', function (Blueprint $table) {
				$table->id();
				$table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
				$table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
				$table->enum('type', ['video','image'])->index();
				$table->string('disk')->default('org_media');
				$table->string('original_filename');
				$table->string('storage_path');
				$table->string('processed_path')->nullable();
				$table->string('thumbnail_path')->nullable();
				$table->integer('duration')->nullable();
				$table->string('captions_path')->nullable();
				$table->json('safety_labels')->nullable();
				$table->json('meta')->nullable();
				$table->enum('status', ['uploaded','processing','ready','failed'])->default('uploaded')->index();
				$table->timestamp('transcoded_at')->nullable();
				$table->text('processing_errors')->nullable();
				$table->timestamps();
				$table->index(['org_page_id','status']);
			});
		}
	}

	public function down(): void
	{
		Schema::dropIfExists('org_media_assets');
	}
};
