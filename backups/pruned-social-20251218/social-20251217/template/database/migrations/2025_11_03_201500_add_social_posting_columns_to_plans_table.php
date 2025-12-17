<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('plans')) {
            return;
        }

        Schema::table('plans', function (Blueprint $table) {
            if (! Schema::hasColumn('plans', 'allow_social_posts')) {
                $table->boolean('allow_social_posts')->default(false)->after('frontend_show');
            }

            if (! Schema::hasColumn('plans', 'social_post_limit')) {
                $table->integer('social_post_limit')->default(0)->after('allow_social_posts');
            }
        });

        // Ensure existing premium plans unlock social posting by default.
        if (class_exists(\App\Models\Plan::class)) {
            \App\Models\Plan::where('label', 'like', '%premium%')
                ->update([
                    'allow_social_posts' => true,
                    'social_post_limit' => 50,
                ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('plans')) {
            return;
        }

        Schema::table('plans', function (Blueprint $table) {
            if (Schema::hasColumn('plans', 'social_post_limit')) {
                $table->dropColumn('social_post_limit');
            }

            if (Schema::hasColumn('plans', 'allow_social_posts')) {
                $table->dropColumn('allow_social_posts');
            }
        });
    }
};
