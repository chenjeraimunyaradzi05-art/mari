<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('social_comments')) {
            return;
        }

        if (Schema::hasColumn('social_comments', 'content')) {
            return;
        }

        Schema::table('social_comments', function (Blueprint $table) {
            $table->renameColumn('comment', 'content');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('social_comments')) {
            return;
        }

        if (! Schema::hasColumn('social_comments', 'content')) {
            return;
        }

        Schema::table('social_comments', function (Blueprint $table) {
            $table->renameColumn('content', 'comment');
        });
    }
};
