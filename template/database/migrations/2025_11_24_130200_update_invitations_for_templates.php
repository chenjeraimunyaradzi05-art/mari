<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('invitations')) {
            return;
        }

        Schema::table('invitations', function (Blueprint $table) {
            if (! Schema::hasColumn('invitations', 'template_key')) {
                $table->string('template_key')->nullable()->after('type');
            }

            if (! Schema::hasColumn('invitations', 'metadata')) {
                $table->json('metadata')->nullable()->after('message');
            }

            if (! Schema::hasColumn('invitations', 'mentorship_cohort_id')) {
                $table->foreignId('mentorship_cohort_id')->nullable()->after('receiver_id')
                    ->constrained('mentorship_cohorts')->nullOnDelete();
            }

            if (! Schema::hasColumn('invitations', 'mentorship_match_id')) {
                $table->foreignId('mentorship_match_id')->nullable()->after('mentorship_cohort_id')
                    ->constrained('mentorship_matches')->nullOnDelete();
            }

            if (! Schema::hasColumn('invitations', 'nudges_scheduled_at')) {
                $table->timestamp('nudges_scheduled_at')->nullable()->after('status');
            }

            if (! Schema::hasColumn('invitations', 'last_nudged_at')) {
                $table->timestamp('last_nudged_at')->nullable()->after('nudges_scheduled_at');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('invitations')) {
            return;
        }

        Schema::table('invitations', function (Blueprint $table) {
            if (Schema::hasColumn('invitations', 'last_nudged_at')) {
                $table->dropColumn('last_nudged_at');
            }

            if (Schema::hasColumn('invitations', 'nudges_scheduled_at')) {
                $table->dropColumn('nudges_scheduled_at');
            }

            if (Schema::hasColumn('invitations', 'mentorship_match_id')) {
                $table->dropConstrainedForeignId('mentorship_match_id');
            }

            if (Schema::hasColumn('invitations', 'mentorship_cohort_id')) {
                $table->dropConstrainedForeignId('mentorship_cohort_id');
            }

            if (Schema::hasColumn('invitations', 'metadata')) {
                $table->dropColumn('metadata');
            }

            if (Schema::hasColumn('invitations', 'template_key')) {
                $table->dropColumn('template_key');
            }
        });
    }
};
