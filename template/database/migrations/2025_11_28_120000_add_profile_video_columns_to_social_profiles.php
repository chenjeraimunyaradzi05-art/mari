<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('social_profiles')) {
            return;
        }

        Schema::table('social_profiles', function (Blueprint $table): void {
            if (! Schema::hasColumn('social_profiles', 'profile_video')) {
                $table->string('profile_video')->nullable()->after('cover_photo');
            }

            if (! Schema::hasColumn('social_profiles', 'profile_video_thumbnail')) {
                $table->string('profile_video_thumbnail')->nullable()->after('profile_video');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('social_profiles')) {
            return;
        }

        Schema::table('social_profiles', function (Blueprint $table): void {
            if (Schema::hasColumn('social_profiles', 'profile_video_thumbnail')) {
                $table->dropColumn('profile_video_thumbnail');
            }

            if (Schema::hasColumn('social_profiles', 'profile_video')) {
                $table->dropColumn('profile_video');
            }
        });
    }
};
