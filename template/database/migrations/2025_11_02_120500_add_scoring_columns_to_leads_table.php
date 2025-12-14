<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::table('leads', function (Blueprint $table) {
			$table->unsignedTinyInteger('qualification_score')
				->nullable()
				->after('status');

			$table->string('qualification_grade', 8)
				->nullable()
				->after('qualification_score');

			$table->string('qualification_priority', 20)
				->nullable()
				->after('qualification_grade');

			$table->json('qualification_factors')
				->nullable()
				->after('qualification_priority');

			$table->text('ai_summary')
				->nullable()
				->after('qualification_factors');

			$table->text('ai_recommendations')
				->nullable()
				->after('ai_summary');

			$table->index('qualification_priority', 'leads_qualification_priority_idx');
		});
	}

	public function down(): void
	{
		Schema::table('leads', function (Blueprint $table) {
			$table->dropIndex('leads_qualification_priority_idx');
			$table->dropColumn([
				'qualification_score',
				'qualification_grade',
				'qualification_priority',
				'qualification_factors',
				'ai_summary',
				'ai_recommendations',
			]);
		});
	}
};
