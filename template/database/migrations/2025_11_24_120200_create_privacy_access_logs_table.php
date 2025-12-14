<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		if (Schema::hasTable('privacy_access_logs')) {
			return;
		}

		Schema::create('privacy_access_logs', function (Blueprint $table): void {
			$table->id();
			$table->unsignedBigInteger('user_id')->nullable();
			$table->unsignedBigInteger('profile_id')->nullable();
			$table->unsignedBigInteger('social_profile_id')->nullable();
			$table->string('channel', 80);
			$table->string('privacy_tier', 32);
			$table->json('requested_fields')->nullable();
			$table->json('granted_fields')->nullable();
			$table->json('denied_fields')->nullable();
			$table->string('decision', 40)->nullable();
			$table->json('metadata')->nullable();
			$table->timestamp('checked_at')->useCurrent();
			$table->timestamps();

			$table->index('channel');
			$table->index('privacy_tier');
			$table->index('user_id');
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('privacy_access_logs');
	}
};
