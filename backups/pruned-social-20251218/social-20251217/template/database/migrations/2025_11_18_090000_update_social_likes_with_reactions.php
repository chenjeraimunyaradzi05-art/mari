<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_likes')) {
            Schema::table('social_likes', function (Blueprint $table): void {
                if (! Schema::hasColumn('social_likes', 'user_id')) {
                    $table->foreignId('user_id')->nullable()->after('social_profile_id')->constrained()->nullOnDelete();
                }

                if (! Schema::hasColumn('social_likes', 'social_post_id')) {
                    $table->foreignId('social_post_id')->nullable()->after('user_id')->constrained('social_posts')->cascadeOnDelete();
                }

                if (! Schema::hasColumn('social_likes', 'reaction')) {
                    $table->string('reaction', 30)->default('like')->after('liked_at');
                    $table->index(['reaction', 'liked_at'], 'social_likes_reaction_idx');
                }
            });
        }

        if (Schema::hasTable('social_posts') && ! Schema::hasColumn('social_posts', 'reaction_breakdown')) {
            Schema::table('social_posts', function (Blueprint $table): void {
                $table->json('reaction_breakdown')->nullable()->after('likes_count');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('social_likes')) {
            Schema::table('social_likes', function (Blueprint $table): void {
                if (Schema::hasColumn('social_likes', 'reaction')) {
                    $table->dropIndex('social_likes_reaction_idx');
                    $table->dropColumn('reaction');
                }

                if (Schema::hasColumn('social_likes', 'social_post_id')) {
                    $table->dropConstrainedForeignId('social_post_id');
                }

                if (Schema::hasColumn('social_likes', 'user_id')) {
                    $table->dropConstrainedForeignId('user_id');
                }
            });
        }

        if (Schema::hasTable('social_posts') && Schema::hasColumn('social_posts', 'reaction_breakdown')) {
            Schema::table('social_posts', function (Blueprint $table): void {
                $table->dropColumn('reaction_breakdown');
            });
        }
    }
};
