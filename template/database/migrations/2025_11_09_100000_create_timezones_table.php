<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	public function up(): void
	{
		if (! Schema::hasTable('timezones')) {
			Schema::create('timezones', function (Blueprint $table): void {
				$table->id();
				$table->string('name', 191)->unique();
				$table->string('region', 120)->nullable();
				$table->string('country_code', 4)->nullable();
				$table->integer('offset_minutes');
				$table->boolean('is_dst')->default(false);
				$table->timestamps();

				$table->index(['region', 'country_code'], 'timezones_region_country_idx');
			});
		}
	}

	public function down(): void
	{
		Schema::dropIfExists('timezones');
	}
};
