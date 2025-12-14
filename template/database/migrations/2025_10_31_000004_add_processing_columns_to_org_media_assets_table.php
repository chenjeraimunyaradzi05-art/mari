<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::table('org_media_assets', function (Blueprint $table) {
			if (! Schema::hasColumn('org_media_assets', 'uploaded_by')) {
				$table->foreignId('uploaded_by')->nullable()->after('org_page_id')->constrained('users')->nullOnDelete();
			}

			if (! Schema::hasColumn('org_media_assets', 'disk')) {
				$table->string('disk')->default('org_media')->after('type');
			}

			if (! Schema::hasColumn('org_media_assets', 'original_filename')) {
				$table->string('original_filename')->nullable()->after('disk');
			}

			if (! Schema::hasColumn('org_media_assets', 'processed_path')) {
				$table->string('processed_path')->nullable()->after('storage_path');
			}

			if (! Schema::hasColumn('org_media_assets', 'thumbnail_path')) {
				$table->string('thumbnail_path')->nullable()->after('processed_path');
			}

			if (! Schema::hasColumn('org_media_assets', 'captions_path')) {
				$table->string('captions_path')->nullable()->after('thumbnail_path');
			}

			if (! Schema::hasColumn('org_media_assets', 'meta')) {
				$table->json('meta')->nullable()->after('safety_labels');
			}

			if (! Schema::hasColumn('org_media_assets', 'status')) {
				$table->enum('status', ['uploaded','processing','ready','failed'])->default('uploaded')->after('meta')->index();
			}

			if (! Schema::hasColumn('org_media_assets', 'transcoded_at')) {
				$table->timestamp('transcoded_at')->nullable()->after('status');
			}

			if (! Schema::hasColumn('org_media_assets', 'processing_errors')) {
				$table->text('processing_errors')->nullable()->after('transcoded_at');
			}
		});
	}

	public function down(): void
	{
		Schema::table('org_media_assets', function (Blueprint $table) {
			if (Schema::hasColumn('org_media_assets', 'uploaded_by')) {
				$table->dropConstrainedForeignId('uploaded_by');
			}

			$droppable = [
				'disk',
				'original_filename',
				'processed_path',
				'thumbnail_path',
				'captions_path',
				'meta',
				'status',
				'transcoded_at',
				'processing_errors',
			];

			foreach ($droppable as $column) {
				if (Schema::hasColumn('org_media_assets', $column)) {
					$table->dropColumn($column);
				}
			}
		});
	}
};
