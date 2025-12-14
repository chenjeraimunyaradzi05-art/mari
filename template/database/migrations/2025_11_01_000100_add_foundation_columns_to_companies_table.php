<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		Schema::table('companies', function (Blueprint $table) {
			if (! Schema::hasColumn('companies', 'foundation_status')) {
				$table->string('foundation_status', 50)
					->default('inactive')
					->after('verification_source')
					->index('companies_foundation_status_index');
			}

			if (! Schema::hasColumn('companies', 'foundation_summary')) {
				$table->text('foundation_summary')->nullable()->after('foundation_status');
			}

			if (! Schema::hasColumn('companies', 'foundation_focus_areas')) {
				$table->json('foundation_focus_areas')->nullable()->after('foundation_summary');
			}

			if (! Schema::hasColumn('companies', 'foundation_programs')) {
				$table->json('foundation_programs')->nullable()->after('foundation_focus_areas');
			}

			if (! Schema::hasColumn('companies', 'foundation_impact_metrics')) {
				$table->json('foundation_impact_metrics')->nullable()->after('foundation_programs');
			}

			if (! Schema::hasColumn('companies', 'foundation_contact_name')) {
				$table->string('foundation_contact_name')->nullable()->after('foundation_impact_metrics');
			}

			if (! Schema::hasColumn('companies', 'foundation_contact_email')) {
				$table->string('foundation_contact_email')->nullable()->after('foundation_contact_name');
			}

			if (! Schema::hasColumn('companies', 'foundation_contact_phone')) {
				$table->string('foundation_contact_phone', 50)->nullable()->after('foundation_contact_email');
			}

			if (! Schema::hasColumn('companies', 'foundation_donation_url')) {
				$table->string('foundation_donation_url')->nullable()->after('foundation_contact_phone');
			}

			if (! Schema::hasColumn('companies', 'foundation_video_url')) {
				$table->string('foundation_video_url')->nullable()->after('foundation_donation_url');
			}

			if (! Schema::hasColumn('companies', 'foundation_cta_label')) {
				$table->string('foundation_cta_label')->nullable()->after('foundation_video_url');
			}

			if (! Schema::hasColumn('companies', 'foundation_cta_url')) {
				$table->string('foundation_cta_url')->nullable()->after('foundation_cta_label');
			}

			if (! Schema::hasColumn('companies', 'foundation_launched_at')) {
				$table->timestamp('foundation_launched_at')->nullable()->after('foundation_cta_url');
			}

			if (! Schema::hasColumn('companies', 'foundation_social_links')) {
				$table->json('foundation_social_links')->nullable()->after('foundation_launched_at');
			}
		});
	}

	public function down(): void
	{
		Schema::table('companies', function (Blueprint $table) {
			if (Schema::hasColumn('companies', 'foundation_social_links')) {
				$table->dropColumn('foundation_social_links');
			}

			if (Schema::hasColumn('companies', 'foundation_launched_at')) {
				$table->dropColumn('foundation_launched_at');
			}

			if (Schema::hasColumn('companies', 'foundation_cta_url')) {
				$table->dropColumn('foundation_cta_url');
			}

			if (Schema::hasColumn('companies', 'foundation_cta_label')) {
				$table->dropColumn('foundation_cta_label');
			}

			if (Schema::hasColumn('companies', 'foundation_video_url')) {
				$table->dropColumn('foundation_video_url');
			}

			if (Schema::hasColumn('companies', 'foundation_donation_url')) {
				$table->dropColumn('foundation_donation_url');
			}

			if (Schema::hasColumn('companies', 'foundation_contact_phone')) {
				$table->dropColumn('foundation_contact_phone');
			}

			if (Schema::hasColumn('companies', 'foundation_contact_email')) {
				$table->dropColumn('foundation_contact_email');
			}

			if (Schema::hasColumn('companies', 'foundation_contact_name')) {
				$table->dropColumn('foundation_contact_name');
			}

			if (Schema::hasColumn('companies', 'foundation_impact_metrics')) {
				$table->dropColumn('foundation_impact_metrics');
			}

			if (Schema::hasColumn('companies', 'foundation_programs')) {
				$table->dropColumn('foundation_programs');
			}

			if (Schema::hasColumn('companies', 'foundation_focus_areas')) {
				$table->dropColumn('foundation_focus_areas');
			}

			if (Schema::hasColumn('companies', 'foundation_summary')) {
				$table->dropColumn('foundation_summary');
			}

			if (Schema::hasColumn('companies', 'foundation_status')) {
				$table->dropIndex(['foundation_status']);
				$table->dropColumn('foundation_status');
			}
		});
	}
};
