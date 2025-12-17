<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('social_profiles')) {
            return;
        }

        DB::table('social_profiles')->orderBy('id')->chunkById(100, function ($profiles): void {
            foreach ($profiles as $profile) {
                $updates = [];

                if (is_null($profile->username)) {
                    $updates['username'] = $profile->handle ?: 'member_'.$profile->id;
                }

                if (is_null($profile->display_name)) {
                    $updates['display_name'] = $profile->handle
                        ?: ($updates['username'] ?? $profile->username ?? 'Member '.$profile->id);
                }

                if (is_null($profile->profile_type)) {
                    $updates['profile_type'] = $profile->candidate_id ? 'candidate' : 'company';
                }

                if (is_null($profile->followers_count)) {
                    $updates['followers_count'] = 0;
                }

                if (is_null($profile->following_count)) {
                    $updates['following_count'] = 0;
                }

                if (is_null($profile->posts_count)) {
                    $updates['posts_count'] = 0;
                }

                if (is_null($profile->profileable_type) || is_null($profile->profileable_id)) {
                    $profileableType = null;
                    $profileableId = null;

                    if (! is_null($profile->candidate_id)) {
                        $profileableType = 'App\\Models\\Candidate';
                        $profileableId = $profile->candidate_id;
                    } else {
                        $companyId = DB::table('companies')->where('user_id', $profile->user_id)->value('id');

                        if ($companyId) {
                            $profileableType = 'App\\Models\\Company';
                            $profileableId = $companyId;
                        } else {
                            $profileableType = 'App\\Models\\User';
                            $profileableId = $profile->user_id;
                            $updates['profile_type'] = $updates['profile_type'] ?? 'user';
                        }
                    }

                    $updates['profileable_type'] = $profileableType;
                    $updates['profileable_id'] = $profileableId;
                }

                if (! empty($updates)) {
                    DB::table('social_profiles')
                        ->where('id', $profile->id)
                        ->update($updates);
                }
            }
        });

        if (Schema::hasTable('social_posts')) {
            DB::table('social_posts')->orderBy('id')->chunkById(100, function ($posts): void {
                foreach ($posts as $post) {
                    $updates = [];

                    if (is_null($post->social_profile_id)) {
                        $profileId = DB::table('social_profiles')
                            ->where('user_id', $post->user_id)
                            ->value('id');

                        if ($profileId) {
                            $updates['social_profile_id'] = $profileId;
                        }
                    }

                    if (is_null($post->post_type)) {
                        $updates['post_type'] = 'post';
                    }

                    if (! empty($updates)) {
                        DB::table('social_posts')
                            ->where('id', $post->id)
                            ->update($updates);
                    }
                }
            });
        }

        if (Schema::hasTable('social_post_media')) {
            DB::table('social_post_media')
                ->whereNull('sort_order')
                ->update(['sort_order' => 0]);
        }

        if (Schema::hasTable('social_follows') && Schema::hasTable('legacy_social_follows')) {
            DB::table('legacy_social_follows')->orderBy('id')->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $followerProfileId = DB::table('social_profiles')
                        ->where('user_id', $row->follower_id)
                        ->value('id');

                    if (! $followerProfileId) {
                        continue;
                    }

                    $followingProfileId = null;

                    if ($row->followable_type === 'App\\Models\\Candidate') {
                        $followingProfileId = DB::table('social_profiles')
                            ->where('candidate_id', $row->followable_id)
                            ->value('id');
                    } elseif ($row->followable_type === 'App\\Models\\User') {
                        $followingProfileId = DB::table('social_profiles')
                            ->where('user_id', $row->followable_id)
                            ->value('id');
                    } elseif ($row->followable_type === 'App\\Models\\Company') {
                        $companyUserId = DB::table('companies')
                            ->where('id', $row->followable_id)
                            ->value('user_id');

                        if ($companyUserId) {
                            $followingProfileId = DB::table('social_profiles')
                                ->where('user_id', $companyUserId)
                                ->value('id');
                        }
                    }

                    if (! $followingProfileId) {
                        $followingProfileId = DB::table('social_profiles')
                            ->where('user_id', $row->followable_id)
                            ->value('id');
                    }

                    if (! $followingProfileId) {
                        continue;
                    }

                    DB::table('social_follows')->updateOrInsert(
                        [
                            'follower_id' => $followerProfileId,
                            'following_id' => $followingProfileId,
                        ],
                        [
                            'is_close_friend' => false,
                            'notifications_enabled' => true,
                            'followed_at' => $row->followed_at ?? now(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]
                    );
                }
            });
        }
    }

    public function down(): void
    {
        // No-op: data backfill should not be reversed automatically.
    }
};
