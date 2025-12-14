<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		if (Schema::hasTable('social_profiles')) {
			DB::table('social_profiles')
				->whereNull('is_verified')
				->update(['is_verified' => false]);

			DB::table('social_profiles')
				->whereNull('is_private')
				->update(['is_private' => false]);

			DB::table('social_profiles')
				->whereNull('following_count')
				->update(['following_count' => 0]);

			DB::table('social_profiles')
				->whereNull('posts_count')
				->update(['posts_count' => 0]);
		}

		if (Schema::hasTable('social_posts')) {
			DB::table('social_posts')
				->whereNull('post_type')
				->update(['post_type' => 'post']);

			DB::table('social_posts')
				->whereNull('likes_count')
				->update(['likes_count' => 0]);

			DB::table('social_posts')
				->whereNull('comments_count')
				->update(['comments_count' => 0]);

			DB::table('social_posts')
				->whereNull('shares_count')
				->update(['shares_count' => 0]);

			DB::table('social_posts')
				->whereNull('views_count')
				->update(['views_count' => 0]);

			DB::table('social_posts')
				->whereNull('is_pinned')
				->update(['is_pinned' => false]);

			DB::table('social_posts')
				->whereNull('comments_disabled')
				->update(['comments_disabled' => false]);
		}

		if (Schema::hasTable('social_post_comments')) {
			DB::table('social_post_comments')
				->whereNull('mentions')
				->update(['mentions' => json_encode([])]);

			DB::table('social_post_comments')
				->whereNull('likes_count')
				->update(['likes_count' => 0]);

			DB::table('social_post_comments')
				->whereNull('replies_count')
				->update(['replies_count' => 0]);

			DB::table('social_post_comments')
				->whereNull('is_pinned')
				->update(['is_pinned' => false]);
		}

		if (Schema::hasTable('social_post_media')) {
			DB::table('social_post_media')
				->whereNull('sort_order')
				->update(['sort_order' => 0]);
		}
	}

	public function down(): void
	{
		// Data normalisation only.
	}
};
