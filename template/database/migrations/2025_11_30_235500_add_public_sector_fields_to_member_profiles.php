<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('member_profiles', function (Blueprint $table) {
            $table->json('public_sector_interests')->nullable();
            $table->string('government_clearance')->nullable();
            $table->json('preferred_agencies')->nullable();
            $table->text('civic_impact_goals')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('member_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'public_sector_interests',
                'government_clearance',
                'preferred_agencies',
                'civic_impact_goals'
            ]);
        });
    }
};
