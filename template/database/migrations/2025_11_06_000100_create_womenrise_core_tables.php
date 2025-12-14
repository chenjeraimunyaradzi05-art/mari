<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::create('housing_listings', function (Blueprint $table) {
			$table->id();
			$table->uuid('uuid')->unique();
			$table->foreignId('org_page_id')->nullable()->constrained('organization_pages')->nullOnDelete();
			$table->foreignId('landlord_user_id')->nullable()->constrained('users')->nullOnDelete();
			$table->string('title');
			$table->string('slug')->unique();
			$table->enum('listing_type', ['rent','share','buy'])->default('rent');
			$table->string('property_type')->nullable();
			$table->boolean('furnished')->default(false);
			$table->unsignedTinyInteger('bedrooms')->nullable();
			$table->unsignedTinyInteger('bathrooms')->nullable();
			$table->unsignedTinyInteger('parking_spaces')->nullable();
			$table->unsignedBigInteger('rent_cents')->nullable();
			$table->enum('rent_frequency', ['weekly','fortnightly','monthly'])->default('weekly');
			$table->unsignedBigInteger('bond_cents')->nullable();
			$table->string('currency', 3)->default('AUD');
			$table->date('available_from')->nullable();
			$table->string('occupancy_preference')->nullable();
			$table->enum('safety_level', ['pending','verified','flagged'])->default('pending');
			$table->json('amenities')->nullable();
			$table->json('house_rules')->nullable();
			$table->json('safety_features')->nullable();
			$table->string('address_line1')->nullable();
			$table->string('address_line2')->nullable();
			$table->string('suburb')->nullable();
			$table->string('region')->nullable();
			$table->string('postcode', 12)->nullable();
			$table->string('country', 2)->nullable();
			$table->decimal('latitude', 10, 7)->nullable();
			$table->decimal('longitude', 10, 7)->nullable();
			$table->enum('status', ['draft','published','archived'])->default('draft')->index();
			$table->enum('verification_status', ['pending','verified','rejected'])->default('pending')->index();
			$table->timestamps();
			$table->softDeletes();

			$table->index(['org_page_id', 'status']);
		});

		Schema::create('mentorship_programs', function (Blueprint $table) {
			$table->id();
			$table->uuid('uuid')->unique();
			$table->foreignId('org_page_id')->nullable()->constrained('organization_pages')->nullOnDelete();
			$table->foreignId('mentor_user_id')->nullable()->constrained('users')->nullOnDelete();
			$table->string('title');
			$table->string('slug')->unique();
			$table->string('focus_area')->nullable();
			$table->enum('delivery_mode', ['virtual','in_person','hybrid'])->nullable();
			$table->unsignedInteger('capacity')->nullable();
			$table->unsignedInteger('duration_minutes')->nullable();
			$table->unsignedBigInteger('price_cents')->nullable();
			$table->string('currency', 3)->default('AUD');
			$table->decimal('revenue_share', 5, 2)->default(20.00);
			$table->json('matching_criteria')->nullable();
			$table->json('impact_metrics')->nullable();
			$table->enum('status', ['draft','published','archived'])->default('draft')->index();
			$table->timestamps();
			$table->softDeletes();
		});

		Schema::create('mentorship_sessions', function (Blueprint $table) {
			$table->id();
			$table->foreignId('program_id')->constrained('mentorship_programs')->cascadeOnDelete();
			$table->foreignId('mentor_user_id')->nullable()->constrained('users')->nullOnDelete();
			$table->foreignId('mentee_user_id')->nullable()->constrained('users')->nullOnDelete();
			$table->dateTime('scheduled_for')->nullable();
			$table->unsignedInteger('duration_minutes')->default(60);
			$table->enum('status', ['pending','scheduled','completed','cancelled'])->default('pending')->index();
			$table->string('meeting_link')->nullable();
			$table->json('notes')->nullable();
			$table->timestamps();
		});

		Schema::create('incident_reports', function (Blueprint $table) {
			$table->id();
			$table->uuid('uuid')->unique();
			$table->foreignId('reporter_user_id')->constrained('users')->cascadeOnDelete();
			$table->foreignId('subject_user_id')->nullable()->constrained('users')->nullOnDelete();
			$table->foreignId('org_page_id')->nullable()->constrained('organization_pages')->nullOnDelete();
			$table->string('category')->index();
			$table->enum('severity', ['low','medium','high','critical'])->default('medium')->index();
			$table->longText('description');
			$table->enum('status', ['open','in_review','resolved','escalated','closed'])->default('open')->index();
			$table->json('metadata')->nullable();
			$table->timestamp('occurred_at')->nullable();
			$table->timestamp('resolved_at')->nullable();
			$table->timestamps();
			$table->softDeletes();
		});

		Schema::create('incident_events', function (Blueprint $table) {
			$table->id();
			$table->foreignId('incident_id')->constrained('incident_reports')->cascadeOnDelete();
			$table->foreignId('author_user_id')->nullable()->constrained('users')->nullOnDelete();
			$table->string('action');
			$table->text('notes')->nullable();
			$table->timestamps();
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('incident_events');
		Schema::dropIfExists('incident_reports');
		Schema::dropIfExists('mentorship_sessions');
		Schema::dropIfExists('mentorship_programs');
		Schema::dropIfExists('housing_listings');
	}
};
