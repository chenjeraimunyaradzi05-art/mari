<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('women_persona_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('persona', ['househunter', 'landlord', 'agent', 'investor', 'ally'])->default('househunter');
            $table->json('identity')->nullable();
            $table->json('household')->nullable();
            $table->json('lifestyle')->nullable();
            $table->json('work')->nullable();
            $table->json('transport')->nullable();
            $table->json('media')->nullable();
            $table->json('ai_meta')->nullable();
            $table->json('social_meta')->nullable();
            $table->json('visibility_preferences')->nullable();
            $table->foreignId('featured_media_id')->nullable()->constrained('women_real_estate_user_media')->nullOnDelete();
            $table->unsignedTinyInteger('completion_score')->default(0);
            $table->boolean('highlight_in_feed')->default(false);
            $table->boolean('auto_share_opt_in')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'persona']);
            $table->index('persona');
        });

        Schema::create('women_persona_profile_audits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('persona_profile_id')->constrained('women_persona_profiles')->cascadeOnDelete();
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('changes')->nullable();
            $table->json('visibility_snapshot')->nullable();
            $table->string('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('women_agent_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('license_number')->nullable();
            $table->string('license_region')->nullable();
            $table->date('license_expires_at')->nullable();
            $table->json('accomplishments')->nullable();
            $table->json('testimonials')->nullable();
            $table->json('service_languages')->nullable();
            $table->json('availability_slots')->nullable();
            $table->json('ai_meta')->nullable();
            $table->json('visibility_preferences')->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamps();
        });

        Schema::table('women_property_seekers', function (Blueprint $table): void {
            $table->unsignedTinyInteger('financial_confidence')->nullable()->after('preferred_move_in_days');
            $table->enum('mortgage_preapproval_status', ['not_started', 'in_progress', 'preapproved', 'expired'])->default('not_started')->after('financial_confidence');
            $table->json('property_goals')->nullable()->after('mortgage_preapproval_status');
        });

        Schema::table('women_listings', function (Blueprint $table): void {
            $table->longText('owner_story')->nullable()->after('description');
            $table->json('safety_commitments')->nullable()->after('owner_story');
            $table->foreignId('virtual_tour_media_id')->nullable()->after('safety_commitments')->constrained('women_real_estate_user_media')->nullOnDelete();
            $table->json('ai_listing_summary')->nullable()->after('virtual_tour_media_id');
        });
    }

    public function down(): void
    {
        Schema::table('women_listings', function (Blueprint $table): void {
            $table->dropForeign(['virtual_tour_media_id']);
            $table->dropColumn(['owner_story', 'safety_commitments', 'virtual_tour_media_id', 'ai_listing_summary']);
        });

        Schema::table('women_property_seekers', function (Blueprint $table): void {
            $table->dropColumn(['financial_confidence', 'mortgage_preapproval_status', 'property_goals']);
        });

        Schema::dropIfExists('women_agent_profiles');
        Schema::dropIfExists('women_persona_profile_audits');
        Schema::dropIfExists('women_persona_profiles');
    }
};
