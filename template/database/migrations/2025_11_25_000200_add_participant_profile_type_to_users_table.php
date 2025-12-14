<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'participant_profile_type')) {
                $table->string('participant_profile_type')->default('member')->after('role');
            }

            if (! Schema::hasColumn('users', 'accepted_women_only_policy_at')) {
                $table->timestamp('accepted_women_only_policy_at')->nullable()->after('participant_profile_type');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'accepted_women_only_policy_at')) {
                $table->dropColumn('accepted_women_only_policy_at');
            }

            if (Schema::hasColumn('users', 'participant_profile_type')) {
                $table->dropColumn('participant_profile_type');
            }
        });
    }
};
