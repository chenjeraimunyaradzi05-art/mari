<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('social_post_comments') || ! Schema::hasTable('social_profiles')) {
            return;
        }

        Schema::table('social_post_comments', function (Blueprint $table) {
            $table->foreign('social_profile_id')
                ->references('id')
                ->on('social_profiles')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('social_post_comments')) {
            return;
        }

        Schema::table('social_post_comments', function (Blueprint $table) {
            $table->dropForeign(['social_profile_id']);
        });
    }
};
