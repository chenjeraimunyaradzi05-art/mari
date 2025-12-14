<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
    {
		if (Schema::hasTable('social_profiles')) {
			return;
		}

		Schema::create('social_profiles', function (Blueprint $table) {
			$table->id();
			$table->morphs('profileable');
			$table->string('username')->unique();
			$table->string('display_name');
			$table->text('bio')->nullable();
			$table->string('avatar')->nullable();
			$table->string('cover_photo')->nullable();
			$table->string('website')->nullable();
			$table->json('social_links')->nullable();
			$table->enum('profile_type', [
				'candidate',
				'education_provider',
				'trainee',
				'sole_trader',
				'company',
				'government',
			]);
			$table->boolean('is_verified')->default(false);
			$table->boolean('is_private')->default(false);
			$table->integer('followers_count')->default(0);
			$table->integer('following_count')->default(0);
			$table->integer('posts_count')->default(0);
			$table->timestamps();
			$table->softDeletes();

			$table->index(['profile_type', 'is_verified']);

			if (Schema::getConnection()->getDriverName() === 'mysql') {
				$table->fullText(['username', 'display_name', 'bio']);
			}
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('social_profiles');
	}
};
