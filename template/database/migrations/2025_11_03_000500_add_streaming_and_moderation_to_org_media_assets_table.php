<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('org_media_assets')) {
            return;
        }

        Schema::table('org_media_assets', function (Blueprint $table) {
            if (! Schema::hasColumn('org_media_assets', 'hls_playlist_path')) {
                $table->string('hls_playlist_path')->nullable()->after('processed_path');
            }

            if (! Schema::hasColumn('org_media_assets', 'stream_variants')) {
                $table->json('stream_variants')->nullable()->after('hls_playlist_path');
            }

            if (! Schema::hasColumn('org_media_assets', 'moderation_labels')) {
                $table->json('moderation_labels')->nullable()->after('safety_labels');
            }

            if (! Schema::hasColumn('org_media_assets', 'moderation_status')) {
                $table->string('moderation_status', 32)->nullable()->default('pending')->after('moderation_labels');
                $table->index('moderation_status', 'org_media_assets_moderation_status_idx');
            }

            if (! Schema::hasColumn('org_media_assets', 'moderation_summary')) {
                $table->text('moderation_summary')->nullable()->after('moderation_status');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('org_media_assets')) {
            return;
        }

        Schema::table('org_media_assets', function (Blueprint $table) {
            if (Schema::hasColumn('org_media_assets', 'moderation_summary')) {
                $table->dropColumn('moderation_summary');
            }

            if (Schema::hasColumn('org_media_assets', 'moderation_status')) {
                $table->dropIndex('org_media_assets_moderation_status_idx');
                $table->dropColumn('moderation_status');
            }

            if (Schema::hasColumn('org_media_assets', 'moderation_labels')) {
                $table->dropColumn('moderation_labels');
            }

            if (Schema::hasColumn('org_media_assets', 'stream_variants')) {
                $table->dropColumn('stream_variants');
            }

            if (Schema::hasColumn('org_media_assets', 'hls_playlist_path')) {
                $table->dropColumn('hls_playlist_path');
            }
        });
    }
};
