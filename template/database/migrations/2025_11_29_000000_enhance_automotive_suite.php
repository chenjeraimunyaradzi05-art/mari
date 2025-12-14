<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Enhance Dealers Table
        Schema::table('dealers', function (Blueprint $table) {
            $table->boolean('offers_warranty')->default(false);
            $table->boolean('has_certified_pre_owned')->default(false);
            $table->boolean('is_dealer_approved')->default(false);
            $table->decimal('rating', 3, 2)->nullable();
            $table->json('specialties')->nullable(); // e.g., ["Electric", "Family", "Luxury"]
            $table->json('operating_hours')->nullable();
        });

        // 2. Enhance Vehicle Listings Table
        Schema::table('vehicle_listings', function (Blueprint $table) {
            $table->string('powertrain_type')->nullable(); // Gas, Hybrid, PHEV, Electric
            $table->boolean('rebate_eligible')->default(false);
            $table->decimal('rebate_amount', 10, 2)->nullable();
            $table->text('warranty_description')->nullable();
            $table->boolean('is_certified_pre_owned')->default(false);
            $table->json('pros')->nullable();
            $table->json('cons')->nullable();
            $table->integer('battery_range_km')->nullable(); // For EVs/Hybrids
            $table->integer('charging_time_minutes')->nullable(); // For EVs
        });

        // 3. Create Finance Applications Table
        Schema::create('finance_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_listing_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('loan_amount', 12, 2);
            $table->integer('term_months');
            $table->decimal('annual_income', 12, 2);
            $table->string('employment_status');
            $table->string('status')->default('pending'); // pending, approved, rejected, more_info
            $table->json('provider_responses')->nullable(); // Responses from finance partners
            $table->timestamps();
        });

        // 4. Create Insurance Quotes Table
        Schema::create('insurance_quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_listing_id')->nullable()->constrained()->nullOnDelete();
            $table->string('driver_age_range');
            $table->string('parking_location');
            $table->string('usage_type'); // private, business, rideshare
            $table->decimal('estimated_annual_km', 10, 2);
            $table->json('quotes_received')->nullable(); // [{provider: 'X', premium: 1000, ...}]
            $table->timestamps();
        });

        // 5. Create Vehicle Inquiries Table
        Schema::create('vehicle_inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_listing_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dealer_id')->constrained()->cascadeOnDelete();
            $table->text('message');
            $table->string('inquiry_type')->default('general'); // general, test_drive, finance, trade_in
            $table->string('status')->default('new'); // new, read, replied, closed
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_inquiries');
        Schema::dropIfExists('insurance_quotes');
        Schema::dropIfExists('finance_applications');

        Schema::table('vehicle_listings', function (Blueprint $table) {
            $table->dropColumn([
                'powertrain_type',
                'rebate_eligible',
                'rebate_amount',
                'warranty_description',
                'is_certified_pre_owned',
                'pros',
                'cons',
                'battery_range_km',
                'charging_time_minutes',
            ]);
        });

        Schema::table('dealers', function (Blueprint $table) {
            $table->dropColumn([
                'offers_warranty',
                'has_certified_pre_owned',
                'is_dealer_approved',
                'rating',
                'specialties',
                'operating_hours',
            ]);
        });
    }
};
