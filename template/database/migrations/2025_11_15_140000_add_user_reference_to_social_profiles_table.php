<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('social_profiles')) {
            return;
        }

        if (! Schema::hasColumn('social_profiles', 'user_id')) {
            Schema::table('social_profiles', function (Blueprint $table): void {
                $table->foreignId('user_id')
                    ->nullable()
                    ->after('profileable_id');

                $table->index('user_id');
            });

            Schema::table('social_profiles', function (Blueprint $table): void {
                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            });
        }

        if (Schema::getColumnType('social_profiles', 'profile_type') === 'enum') {
            DB::statement(<<<SQL
                ALTER TABLE social_profiles
                MODIFY COLUMN profile_type ENUM ('candidate', 'education_provider', 'trainee', 'sole_trader', 'company', 'government', 'user')
                DEFAULT 'candidate'
            SQL);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('social_profiles')) {
            return;
        }

        if (Schema::hasColumn('social_profiles', 'user_id')) {
            Schema::table('social_profiles', function (Blueprint $table): void {
                $table->dropForeign(['user_id']);
                $table->dropIndex(['user_id']);
                $table->dropColumn('user_id');
            });
        }
    }
};
