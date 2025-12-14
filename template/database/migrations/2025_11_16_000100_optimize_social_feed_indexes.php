<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_posts')) {
            Schema::table('social_posts', function (Blueprint $table): void {
                if (! $this->indexExists('social_posts', 'social_posts_feed_cursor_idx')) {
                    $table->index(['moderation_status', 'visibility', 'published_at'], 'social_posts_feed_cursor_idx');
                }

                if (! $this->indexExists('social_posts', 'social_posts_expiration_idx')) {
                    $table->index('expires_at', 'social_posts_expiration_idx');
                }
            });
        }

        if (Schema::hasTable('social_post_saves')) {
            Schema::table('social_post_saves', function (Blueprint $table): void {
                if (! $this->indexExists('social_post_saves', 'social_post_saves_post_saved_at_idx')) {
                    $table->index(['social_post_id', 'saved_at'], 'social_post_saves_post_saved_at_idx');
                }
            });
        }

        if (Schema::hasTable('social_comments')) {
            Schema::table('social_comments', function (Blueprint $table): void {
                if (! $this->indexExists('social_comments', 'social_comments_profile_lookup_idx')) {
                    $table->index('social_profile_id', 'social_comments_profile_lookup_idx');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('social_posts')) {
            Schema::table('social_posts', function (Blueprint $table): void {
                if ($this->indexExists('social_posts', 'social_posts_feed_cursor_idx')) {
                    $table->dropIndex('social_posts_feed_cursor_idx');
                }

                if ($this->indexExists('social_posts', 'social_posts_expiration_idx')) {
                    $table->dropIndex('social_posts_expiration_idx');
                }
            });
        }

        if (Schema::hasTable('social_post_saves')) {
            Schema::table('social_post_saves', function (Blueprint $table): void {
                if ($this->indexExists('social_post_saves', 'social_post_saves_post_saved_at_idx')) {
                    $table->dropIndex('social_post_saves_post_saved_at_idx');
                }
            });
        }

        if (Schema::hasTable('social_comments')) {
            Schema::table('social_comments', function (Blueprint $table): void {
                if ($this->indexExists('social_comments', 'social_comments_profile_lookup_idx')) {
                    $table->dropIndex('social_comments_profile_lookup_idx');
                }
            });
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        $connection = Schema::getConnection()->getDriverName();

        return match ($connection) {
            'mysql' => $this->mysqlIndexExists($table, $index),
            'pgsql' => $this->postgresIndexExists($table, $index),
            'sqlite' => $this->sqliteIndexExists($table, $index),
            default => false,
        };
    }

    private function mysqlIndexExists(string $table, string $index): bool
    {
        $result = DB::select(sprintf('SHOW INDEX FROM `%s` WHERE Key_name = ?', $table), [$index]);

        return count($result) > 0;
    }

    private function postgresIndexExists(string $table, string $index): bool
    {
        $result = DB::select('SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1', [$table, $index]);

        return count($result) > 0;
    }

    private function sqliteIndexExists(string $table, string $index): bool
    {
        $result = DB::select('PRAGMA index_list("'.$table.'")');

        foreach ($result as $item) {
            if (($item->name ?? null) === $index) {
                return true;
            }
        }

        return false;
    }
};
