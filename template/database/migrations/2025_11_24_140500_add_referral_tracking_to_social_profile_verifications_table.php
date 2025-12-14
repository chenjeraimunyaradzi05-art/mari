<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_profile_verifications', function (Blueprint $table) {
            $table->foreignId('referral_invite_id')
                ->nullable()
                ->after('reviewed_by')
                ->constrained('invites')
                ->nullOnDelete();
            $table->string('referral_code', 64)
                ->nullable()
                ->after('referral_invite_id');
            $table->json('privacy_snapshot')
                ->nullable()
                ->after('referral_code');

            $table->index('referral_code', 'social_profile_verifications_referral_code_index');
        });
    }

    public function down(): void
    {
        Schema::table('social_profile_verifications', function (Blueprint $table) {
            $table->dropIndex('social_profile_verifications_referral_code_index');
            $table->dropForeign(['referral_invite_id']);
            $table->dropColumn(['referral_invite_id', 'referral_code', 'privacy_snapshot']);
        });
    }
};
