<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('social_profiles', 'verification_status')) {
                $table->string('verification_status')->default('unverified')->after('is_verified');
            }

            if (! Schema::hasColumn('social_profiles', 'verification_submitted_at')) {
                $table->timestamp('verification_submitted_at')->nullable()->after('verification_status');
            }

            if (! Schema::hasColumn('social_profiles', 'verification_reviewed_at')) {
                $table->timestamp('verification_reviewed_at')->nullable()->after('verification_submitted_at');
            }

            if (! Schema::hasColumn('social_profiles', 'verification_reviewer_id')) {
                $table->foreignId('verification_reviewer_id')
                    ->nullable()
                    ->after('verification_reviewed_at')
                    ->constrained('admins')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('social_profiles', 'verification_notes')) {
                $table->text('verification_notes')->nullable()->after('verification_reviewer_id');
            }

            $table->index('verification_status');
        });
    }

    public function down(): void
    {
        Schema::table('social_profiles', function (Blueprint $table) {
            if (Schema::hasColumn('social_profiles', 'verification_status')) {
                $table->dropColumn('verification_status');
            }

            if (Schema::hasColumn('social_profiles', 'verification_submitted_at')) {
                $table->dropColumn('verification_submitted_at');
            }

            if (Schema::hasColumn('social_profiles', 'verification_reviewed_at')) {
                $table->dropColumn('verification_reviewed_at');
            }

            if (Schema::hasColumn('social_profiles', 'verification_reviewer_id')) {
                $table->dropForeign(['verification_reviewer_id']);
                $table->dropColumn('verification_reviewer_id');
            }

            if (Schema::hasColumn('social_profiles', 'verification_notes')) {
                $table->dropColumn('verification_notes');
            }
        });
    }
};
