<?php

declare(strict_types=1);

use App\Enums\WomenRealEstate\ListingAudience;
use App\Enums\WomenRealEstate\ListingIntent;
use App\Enums\WomenRealEstate\MortgageRateSource;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('women_listing_categories', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('icon')->nullable();
            $table->timestamps();
        });

        Schema::create('women_listing_locations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('women_listing_locations');
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('type')->default('suburb');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamps();
        });

        Schema::create('women_verified_agents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('license_number');
            $table->date('license_expires_at')->nullable();
            $table->string('regulator')->nullable();
            $table->string('status')->default('pending');
            $table->json('verification_payload')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        Schema::create('women_listings', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('owner_id')->constrained('users');
            $table->foreignId('agent_id')->nullable()->constrained('women_verified_agents');
            $table->foreignId('category_id')->nullable()->constrained('women_listing_categories');
            $table->foreignId('location_id')->nullable()->constrained('women_listing_locations');
            $table->string('title');
            $table->string('slug')->unique();
            $table->enum('intent', array_column(ListingIntent::cases(), 'value'));
            $table->enum('primary_audience', array_column(ListingAudience::cases(), 'value'));
            $table->json('audience_overrides')->nullable();
            $table->text('summary');
            $table->longText('description')->nullable();
            $table->json('features')->nullable();
            $table->unsignedInteger('bedrooms')->nullable();
            $table->unsignedInteger('bathrooms')->nullable();
            $table->unsignedInteger('car_spaces')->nullable();
            $table->decimal('price', 16, 2)->nullable();
            $table->string('price_frequency')->nullable();
            $table->string('currency', 3)->default('AUD');
            $table->boolean('is_verified')->default(false);
            $table->boolean('is_ai_safe')->default(false);
            $table->json('ai_insights')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['owner_id', 'intent']);
            $table->index(['primary_audience', 'published_at']);
            $table->index(['location_id']);
        });

        Schema::create('women_listing_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('listing_id')->constrained('women_listings')->cascadeOnDelete();
            $table->string('type')->default('image');
            $table->string('path');
            $table->string('caption')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('women_listing_audience_pivots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('listing_id')->constrained('women_listings')->cascadeOnDelete();
            $table->enum('audience', array_column(ListingAudience::cases(), 'value'));
            $table->timestamps();

            $table->unique(['listing_id', 'audience']);
        });

        Schema::create('women_mortgage_market_rates', function (Blueprint $table): void {
            $table->id();
            $table->enum('source', array_column(MortgageRateSource::cases(), 'value'))->default(MortgageRateSource::RBA->value);
            $table->string('provider')->nullable();
            $table->string('product_name');
            $table->decimal('comparison_rate', 5, 3);
            $table->decimal('variable_rate', 5, 3)->nullable();
            $table->decimal('fixed_rate', 5, 3)->nullable();
            $table->unsignedTinyInteger('fixed_term_years')->nullable();
            $table->string('loan_type')->default('owner_occupied');
            $table->string('repayment_type')->default('principal_interest');
            $table->json('meta')->nullable();
            $table->timestamp('effective_at');
            $table->timestamps();

            $table->index(['source', 'effective_at']);
            $table->index(['provider', 'loan_type']);
        });

        Schema::create('women_listing_mortgage_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('listing_id')->constrained('women_listings')->cascadeOnDelete();
            $table->foreignId('rate_id')->nullable()->constrained('women_mortgage_market_rates')->nullOnDelete();
            $table->decimal('deposit_required', 12, 2)->nullable();
            $table->decimal('principal_amount', 16, 2);
            $table->decimal('comparison_rate', 5, 3);
            $table->decimal('repayment_weekly', 12, 2);
            $table->decimal('repayment_monthly', 12, 2);
            $table->decimal('repayment_fortnightly', 12, 2);
            $table->string('currency', 3)->default('AUD');
            $table->json('ai_commentary')->nullable();
            $table->timestamps();
        });

        Schema::create('women_listing_social_shares', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('listing_id')->constrained('women_listings')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('platform');
            $table->string('share_url');
            $table->timestamp('shared_at');
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('women_listing_partner_intentions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('listing_id')->nullable()->constrained('women_listings')->nullOnDelete();
            $table->foreignId('initiator_id')->constrained('users');
            $table->foreignId('invitee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['draft', 'pending', 'accepted', 'declined', 'withdrawn'])->default('pending');
            $table->string('intent')->default('co_purchase');
            $table->json('preferences')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['initiator_id', 'status']);
            $table->index(['invitee_id', 'status']);
        });

        Schema::create('women_agent_leads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('agent_id')->constrained('women_verified_agents')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('listing_id')->nullable()->constrained('women_listings')->nullOnDelete();
            $table->string('type')->default('buyer');
            $table->string('status')->default('new');
            $table->string('source')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['agent_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('women_agent_leads');
        Schema::dropIfExists('women_listing_partner_intentions');
        Schema::dropIfExists('women_listing_social_shares');
        Schema::dropIfExists('women_listing_mortgage_snapshots');
        Schema::dropIfExists('women_mortgage_market_rates');
        Schema::dropIfExists('women_listing_audience_pivots');
        Schema::dropIfExists('women_listing_media');
        Schema::dropIfExists('women_listings');
        Schema::dropIfExists('women_verified_agents');
        Schema::dropIfExists('women_listing_locations');
        Schema::dropIfExists('women_listing_categories');
    }
};
