<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invites', function (Blueprint $table) {
            if (! Schema::hasColumn('invites', 'cohort_slug')) {
                $table->string('cohort_slug', 100)->nullable()->after('sender_profile_id');
            }

            $table->index('cohort_slug', 'invites_cohort_slug_index');
        });

        DB::table('invites')
            ->select(['id'])
            ->whereNull('referral_code')
            ->orderBy('id')
            ->chunkById(500, function ($invites) {
                foreach ($invites as $invite) {
                    DB::table('invites')
                        ->where('id', $invite->id)
                        ->update(['referral_code' => $this->generateReferralCode($invite->id)]);
                }
            });

        Schema::table('invites', function (Blueprint $table) {
            $table->unique('referral_code', 'invites_referral_code_unique');
        });
    }

    public function down(): void
    {
        Schema::table('invites', function (Blueprint $table) {
            if (Schema::hasColumn('invites', 'cohort_slug')) {
                $table->dropIndex('invites_cohort_slug_index');
                $table->dropColumn('cohort_slug');
            }

            $table->dropUnique('invites_referral_code_unique');
        });
    }

    private function generateReferralCode(int $id): string
    {
        $base36 = strtoupper(str_pad(base_convert($id + 1000, 10, 36), 6, '0', STR_PAD_LEFT));

        return 'INV-'.$base36;
    }
};
