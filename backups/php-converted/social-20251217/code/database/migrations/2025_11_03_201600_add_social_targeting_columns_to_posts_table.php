<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('posts')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            if (! Schema::hasColumn('posts', 'author_type')) {
                $table->enum('author_type', ['candidate', 'company'])->default('candidate')->after('user_id');
            }

            if (! Schema::hasColumn('posts', 'tags')) {
                $table->string('tags')->nullable()->after('content');
            }

            if (! Schema::hasColumn('posts', 'audience_sector')) {
                $table->string('audience_sector', 120)->nullable()->after('type');
            }

            if (! Schema::hasColumn('posts', 'audience_skills')) {
                $table->json('audience_skills')->nullable()->after('audience_sector');
            }

            if (! Schema::hasColumn('posts', 'metadata')) {
                $table->json('metadata')->nullable()->after('audience_skills');
            }

            if (! Schema::hasColumn('posts', 'match_insights')) {
                $table->json('match_insights')->nullable()->after('metadata');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('posts')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            foreach (['match_insights', 'metadata', 'audience_skills', 'audience_sector', 'tags', 'author_type'] as $column) {
                if (Schema::hasColumn('posts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
