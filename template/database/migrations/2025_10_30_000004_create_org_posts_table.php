<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::create('org_posts', function (Blueprint $table) {
			$table->id();
			$table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
			$table->string('title')->nullable();
			$table->longText('content')->nullable();
			$table->unsignedBigInteger('media_id')->nullable()->index();
			$table->enum('visibility', ['public','followers'])->default('public')->index();
			$table->json('tags')->nullable();
			$table->unsignedInteger('likes')->default(0);
			$table->unsignedInteger('comments')->default(0);
			$table->unsignedInteger('shares')->default(0);
			$table->unsignedBigInteger('watch_time')->default(0);
			$table->timestamp('scheduled_at')->nullable();
			$table->timestamp('published_at')->nullable()->index();
			$table->json('meta')->nullable();
			$table->timestamps();
			$table->index(['org_page_id','visibility']);
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('org_posts');
	}
};
