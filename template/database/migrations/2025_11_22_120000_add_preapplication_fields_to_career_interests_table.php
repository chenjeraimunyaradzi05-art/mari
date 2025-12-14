<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('career_interests', function (Blueprint $table) {
            $table->json('target_roles')->nullable()->after('title');
            $table->json('target_sectors')->nullable()->after('target_roles');
            $table->json('preferred_locations_multi')->nullable()->after('preferred_location');
            $table->json('preferred_study_modes')->nullable()->after('preferred_locations_multi');
            $table->string('intake_window')->nullable()->after('timeline');
            $table->text('support_needs')->nullable()->after('notes');
            $table->boolean('notify_in_app')->default(true)->after('support_needs');
            $table->boolean('notify_email')->default(false)->after('notify_in_app');
            $table->boolean('is_active')->default(true)->after('notify_email');
            $table->timestamp('last_matched_at')->nullable()->after('is_active');
            $table->unsignedInteger('match_count')->default(0)->after('last_matched_at');
        });

        DB::table('career_interests')->update([
            'notify_in_app' => true,
            'notify_email' => false,
            'is_active' => DB::raw("CASE WHEN status = 'active' THEN 1 ELSE 0 END"),
            'match_count' => 0,
        ]);
    }

    public function down(): void
    {
        Schema::table('career_interests', function (Blueprint $table) {
            $table->dropColumn([
                'target_roles',
                'target_sectors',
                'preferred_locations_multi',
                'preferred_study_modes',
                'intake_window',
                'support_needs',
                'notify_in_app',
                'notify_email',
                'is_active',
                'last_matched_at',
                'match_count',
            ]);
        });
    }
};
