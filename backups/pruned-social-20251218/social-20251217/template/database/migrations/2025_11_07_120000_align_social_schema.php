<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_profiles')) {
            Schema::table('social_profiles', function (Blueprint $table): void {
                if (! Schema::hasColumn('social_profiles', 'profileable_type')) {
                    $table->string('profileable_type')->nullable()->after('candidate_id');
                    $table->unsignedBigInteger('profileable_id')->nullable()->after('profileable_type');
                    $table->index(['profileable_type', 'profileable_id'], 'social_profiles_profileable_index');
                }

                if (! Schema::hasColumn('social_profiles', 'username')) {
                    $table->string('username')->nullable()->after('profileable_id');
                    $table->unique('username', 'social_profiles_username_unique');
                }

                if (! Schema::hasColumn('social_profiles', 'display_name')) {
                    $table->string('display_name')->nullable()->after('username');
                }

                if (! Schema::hasColumn('social_profiles', 'bio')) {
                    $table->text('bio')->nullable()->after('display_name');
                }

                if (! Schema::hasColumn('social_profiles', 'avatar')) {
                    $table->string('avatar')->nullable()->after('bio');
                }

                if (! Schema::hasColumn('social_profiles', 'cover_photo')) {
                    $table->string('cover_photo')->nullable()->after('avatar');
                }

                if (! Schema::hasColumn('social_profiles', 'website')) {
                    $table->string('website')->nullable()->after('cover_photo');
                }

                if (! Schema::hasColumn('social_profiles', 'social_links')) {
                    $table->json('social_links')->nullable()->after('website');
                }

                if (! Schema::hasColumn('social_profiles', 'profile_type')) {
                    $table->string('profile_type', 40)->default('candidate')->after('social_links');
                    $table->index('profile_type', 'social_profiles_profile_type_index');
                }

                if (! Schema::hasColumn('social_profiles', 'is_verified')) {
                    $table->boolean('is_verified')->default(false)->after('profile_type');
                }

                if (! Schema::hasColumn('social_profiles', 'is_private')) {
                    $table->boolean('is_private')->default(false)->after('is_verified');
                }

                if (! Schema::hasColumn('social_profiles', 'following_count')) {
                    $table->unsignedInteger('following_count')->default(0)->after('followers_count');
                }

                if (! Schema::hasColumn('social_profiles', 'posts_count')) {
                    $table->unsignedInteger('posts_count')->default(0)->after('following_count');
                }

                if (! Schema::hasColumn('social_profiles', 'deleted_at')) {
                    $table->softDeletes();
                }
            });

            if (Schema::hasColumn('social_profiles', 'handle')) {
                DB::table('social_profiles')
                    ->whereNull('username')
                    ->whereNotNull('handle')
                    ->update(['username' => DB::raw('handle')]);
            }

            $driver = Schema::getConnection()->getDriverName();
            $displayNameExpression = $driver === 'sqlite'
                ? DB::raw("COALESCE(username, 'profile-' || id)")
                : DB::raw("COALESCE(username, CONCAT('profile-', id))");

            DB::table('social_profiles')
                ->whereNull('display_name')
                ->update(['display_name' => $displayNameExpression]);

            if ($driver === 'mysql') {
                $indexes = DB::select("SHOW INDEX FROM social_profiles WHERE Key_name = 'social_profiles_search_fulltext'");
                if (count($indexes) === 0 && Schema::hasColumn('social_profiles', 'username')) {
                    DB::statement('ALTER TABLE social_profiles ADD FULLTEXT INDEX social_profiles_search_fulltext (username, display_name, bio)');
                }
            }
        }

        if (Schema::hasTable('social_posts')) {
            Schema::table('social_posts', function (Blueprint $table): void {
                if (! Schema::hasColumn('social_posts', 'social_profile_id')) {
                    $table->foreignId('social_profile_id')->nullable()->after('user_id')->constrained('social_profiles')->nullOnDelete();
                    $table->index('social_profile_id', 'social_posts_profile_index');
                }

                if (! Schema::hasColumn('social_posts', 'post_type')) {
                    $table->enum('post_type', ['post', 'reel', 'story', 'article'])->default('post')->after('social_profile_id');
                }

                if (! Schema::hasColumn('social_posts', 'caption')) {
                    $table->text('caption')->nullable()->after('post_type');
                }

                if (! Schema::hasColumn('social_posts', 'media')) {
                    $table->json('media')->nullable()->after('content');
                }

                if (! Schema::hasColumn('social_posts', 'location')) {
                    $table->string('location')->nullable()->after('media');
                }

                if (! Schema::hasColumn('social_posts', 'tags')) {
                    $table->json('tags')->nullable()->after('location');
                }

                if (! Schema::hasColumn('social_posts', 'mentions')) {
                    $table->json('mentions')->nullable()->after('tags');
                }

                if (! Schema::hasColumn('social_posts', 'likes_count')) {
                    $table->unsignedInteger('likes_count')->default(0)->after('mentions');
                }

                if (! Schema::hasColumn('social_posts', 'comments_count')) {
                    $table->unsignedInteger('comments_count')->default(0)->after('likes_count');
                }

                if (! Schema::hasColumn('social_posts', 'shares_count')) {
                    $table->unsignedInteger('shares_count')->default(0)->after('comments_count');
                }

                if (! Schema::hasColumn('social_posts', 'views_count')) {
                    $table->unsignedInteger('views_count')->default(0)->after('shares_count');
                }

                if (! Schema::hasColumn('social_posts', 'is_pinned')) {
                    $table->boolean('is_pinned')->default(false)->after('views_count');
                }

                if (! Schema::hasColumn('social_posts', 'comments_disabled')) {
                    $table->boolean('comments_disabled')->default(false)->after('is_pinned');
                }

                if (! Schema::hasColumn('social_posts', 'expires_at')) {
                    $table->timestamp('expires_at')->nullable()->after('published_at');
                }

                if (! Schema::hasColumn('social_posts', 'ai_engagement_score')) {
                    $table->float('ai_engagement_score')->default(0)->after('expires_at');
                }

                if (! Schema::hasColumn('social_posts', 'ai_tags')) {
                    $table->json('ai_tags')->nullable()->after('ai_engagement_score');
                }
            });

            if (Schema::hasColumn('social_posts', 'content') && Schema::hasColumn('social_posts', 'caption')) {
                DB::table('social_posts')
                    ->whereNull('caption')
                    ->update(['caption' => DB::raw('content')]);
            }
        }

        if (Schema::hasTable('social_post_media')) {
            Schema::table('social_post_media', function (Blueprint $table): void {
                if (! Schema::hasColumn('social_post_media', 'thumbnail_path')) {
                    $table->string('thumbnail_path')->nullable()->after('path');
                }

                if (! Schema::hasColumn('social_post_media', 'mime_type')) {
                    $table->string('mime_type', 120)->nullable()->after('thumbnail_path');
                }

                if (! Schema::hasColumn('social_post_media', 'file_size')) {
                    $table->unsignedInteger('file_size')->nullable()->after('mime_type');
                }

                if (! Schema::hasColumn('social_post_media', 'width')) {
                    $table->unsignedInteger('width')->nullable()->after('file_size');
                }

                if (! Schema::hasColumn('social_post_media', 'height')) {
                    $table->unsignedInteger('height')->nullable()->after('width');
                }

                if (! Schema::hasColumn('social_post_media', 'duration')) {
                    $table->unsignedInteger('duration')->nullable()->after('height');
                }

                if (! Schema::hasColumn('social_post_media', 'sort_order')) {
                    $table->unsignedSmallInteger('sort_order')->default(0)->after('duration');
                    $table->index(['social_post_id', 'sort_order'], 'spm_post_sort_idx');
                }

                if (! Schema::hasColumn('social_post_media', 'ai_analysis')) {
                    $table->json('ai_analysis')->nullable()->after('sort_order');
                }

                if (! Schema::hasColumn('social_post_media', 'filters')) {
                    $table->json('filters')->nullable()->after('ai_analysis');
                }
            });
        }

        if (Schema::hasTable('social_post_comments')) {
            Schema::table('social_post_comments', function (Blueprint $table): void {
                if (! Schema::hasColumn('social_post_comments', 'social_profile_id')) {
                    $table->foreignId('social_profile_id')->nullable()->after('user_id')->constrained('social_profiles')->nullOnDelete();
                }

                if (! Schema::hasColumn('social_post_comments', 'mentions')) {
                    $table->json('mentions')->nullable()->after('content');
                }

                if (! Schema::hasColumn('social_post_comments', 'likes_count')) {
                    $table->unsignedInteger('likes_count')->default(0)->after('mentions');
                }

                if (! Schema::hasColumn('social_post_comments', 'replies_count')) {
                    $table->unsignedInteger('replies_count')->default(0)->after('likes_count');
                }

                if (! Schema::hasColumn('social_post_comments', 'is_pinned')) {
                    $table->boolean('is_pinned')->default(false)->after('replies_count');
                }

                if (! Schema::hasColumn('social_post_comments', 'ai_sentiment')) {
                    $table->json('ai_sentiment')->nullable()->after('is_pinned');
                }

                if (! Schema::hasColumn('social_post_comments', 'deleted_at')) {
                    $table->softDeletes();
                }
            });
        }

        if (Schema::hasTable('social_post_reactions')) {
            Schema::table('social_post_reactions', function (Blueprint $table): void {
                if (! Schema::hasColumn('social_post_reactions', 'social_profile_id')) {
                    $table->foreignId('social_profile_id')->nullable()->after('social_post_id')->constrained('social_profiles')->nullOnDelete();
                }

                if (! Schema::hasColumn('social_post_reactions', 'liked_at')) {
                    $table->timestamp('liked_at')->useCurrent()->after('reaction');
                }

                if (! Schema::hasColumn('social_post_reactions', 'likeable_type')) {
                    $table->nullableMorphs('likeable');
                    $table->unique(['social_profile_id', 'likeable_type', 'likeable_id'], 'social_post_reactions_likeable_unique');
                }
            });
        }

        if (Schema::hasTable('social_follows') && ! Schema::hasTable('legacy_social_follows')) {
            Schema::rename('social_follows', 'legacy_social_follows');
        }

        if (! Schema::hasTable('social_follows')) {
            Schema::create('social_follows', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('follower_id');
                $table->unsignedBigInteger('following_id');
                $table->boolean('is_close_friend')->default(false);
                $table->boolean('notifications_enabled')->default(true);
                $table->timestamp('followed_at')->useCurrent();
                $table->timestamps();

                $table->unique(['follower_id', 'following_id'], 'social_follows_unique_pair');
                $table->index(['follower_id', 'followed_at'], 'social_follows_follower_idx');
                $table->index(['following_id', 'followed_at'], 'social_follows_following_idx');

                $table->foreign('follower_id', 'social_follows_profile_follower_fk')
                    ->references('id')
                    ->on('social_profiles')
                    ->cascadeOnDelete();

                $table->foreign('following_id', 'social_follows_profile_following_fk')
                    ->references('id')
                    ->on('social_profiles')
                    ->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('social_posts')) {
            Schema::table('social_posts', function (Blueprint $table): void {
                foreach ([
                    'social_profile_id',
                    'post_type',
                    'caption',
                    'media',
                    'location',
                    'tags',
                    'mentions',
                    'likes_count',
                    'comments_count',
                    'shares_count',
                    'views_count',
                    'is_pinned',
                    'comments_disabled',
                    'expires_at',
                    'ai_engagement_score',
                    'ai_tags',
                ] as $column) {
                    if (Schema::hasColumn('social_posts', $column)) {
                        if ($column === 'social_profile_id') {
                            $table->dropConstrainedForeignId('social_profile_id');
                            $table->dropIndex('social_posts_profile_index');
                        } else {
                            $table->dropColumn($column);
                        }
                    }
                }
            });
        }

        if (Schema::hasTable('social_post_media')) {
            Schema::table('social_post_media', function (Blueprint $table): void {
                foreach ([
                    'thumbnail_path',
                    'mime_type',
                    'file_size',
                    'width',
                    'height',
                    'duration',
                    'sort_order',
                    'ai_analysis',
                    'filters',
                ] as $column) {
                    if (Schema::hasColumn('social_post_media', $column)) {
                        if ($column === 'sort_order') {
                            $table->dropIndex('spm_post_sort_idx');
                        }

                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('social_post_comments')) {
            Schema::table('social_post_comments', function (Blueprint $table): void {
                foreach ([
                    'social_profile_id',
                    'mentions',
                    'likes_count',
                    'replies_count',
                    'is_pinned',
                    'ai_sentiment',
                ] as $column) {
                    if (Schema::hasColumn('social_post_comments', $column)) {
                        if ($column === 'social_profile_id') {
                            $table->dropConstrainedForeignId('social_profile_id');
                        } else {
                            $table->dropColumn($column);
                        }
                    }
                }

                if (Schema::hasColumn('social_post_comments', 'deleted_at')) {
                    $table->dropSoftDeletes();
                }
            });
        }

        if (Schema::hasTable('social_post_reactions')) {
            Schema::table('social_post_reactions', function (Blueprint $table): void {
                if (Schema::hasColumn('social_post_reactions', 'social_profile_id')) {
                    $table->dropConstrainedForeignId('social_profile_id');
                }

                if (Schema::hasColumn('social_post_reactions', 'liked_at')) {
                    $table->dropColumn('liked_at');
                }

                if (Schema::hasColumn('social_post_reactions', 'likeable_type')) {
                    $table->dropUnique('social_post_reactions_likeable_unique');
                    $table->dropMorphs('likeable');
                }
            });
        }

        if (Schema::hasTable('social_follows')) {
            Schema::drop('social_follows');
        }

        if (Schema::hasTable('legacy_social_follows') && ! Schema::hasTable('social_follows')) {
            Schema::rename('legacy_social_follows', 'social_follows');
        }

        if (Schema::hasTable('social_profiles')) {
            Schema::table('social_profiles', function (Blueprint $table): void {
                if (Schema::hasColumn('social_profiles', 'profileable_type')) {
                    $table->dropIndex('social_profiles_profileable_index');
                    $table->dropColumn(['profileable_type', 'profileable_id']);
                }

                if (Schema::hasColumn('social_profiles', 'username')) {
                    $table->dropUnique('social_profiles_username_unique');
                    $table->dropColumn('username');
                }

                foreach ([
                    'display_name',
                    'bio',
                    'avatar',
                    'cover_photo',
                    'website',
                    'social_links',
                    'profile_type',
                    'is_verified',
                    'is_private',
                    'following_count',
                    'posts_count',
                ] as $column) {
                    if (Schema::hasColumn('social_profiles', $column)) {
                        if ($column === 'profile_type') {
                            $table->dropIndex('social_profiles_profile_type_index');
                        }

                        $table->dropColumn($column);
                    }
                }

                if (Schema::hasColumn('social_profiles', 'deleted_at')) {
                    $table->dropSoftDeletes();
                }
            });
        }

        if (Schema::hasTable('social_profiles') && Schema::getConnection()->getDriverName() === 'mysql') {
            $indexes = DB::select("SHOW INDEX FROM social_profiles WHERE Key_name = 'social_profiles_search_fulltext'");
            if (count($indexes) > 0) {
                DB::statement('ALTER TABLE social_profiles DROP INDEX social_profiles_search_fulltext');
            }
        }
    }
};
