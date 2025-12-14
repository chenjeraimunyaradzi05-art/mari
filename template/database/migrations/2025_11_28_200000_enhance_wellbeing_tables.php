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
        Schema::table('wellbeing_profiles', function (Blueprint $table) {
            $table->boolean('pref_body_positive')->default(false)->after('pref_vipassana');
            $table->boolean('pref_adaptive')->default(false)->after('pref_body_positive');
            $table->boolean('pref_dv_safe')->default(false)->after('pref_adaptive');
            $table->boolean('pref_prenatal_postnatal')->default(false)->after('pref_dv_safe');
        });

        Schema::table('wellbeing_events', function (Blueprint $table) {
            $table->boolean('is_body_positive')->default(false)->after('women_only');
            $table->boolean('is_adaptive')->default(false)->after('is_body_positive');
            $table->boolean('is_dv_safe')->default(false)->after('is_adaptive');
            $table->boolean('is_prenatal_postnatal')->default(false)->after('is_dv_safe');
            $table->string('accessibility_notes')->nullable()->after('summary');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('wellbeing_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'pref_body_positive',
                'pref_adaptive',
                'pref_dv_safe',
                'pref_prenatal_postnatal',
            ]);
        });

        Schema::table('wellbeing_events', function (Blueprint $table) {
            $table->dropColumn([
                'is_body_positive',
                'is_adaptive',
                'is_dv_safe',
                'is_prenatal_postnatal',
                'accessibility_notes',
            ]);
        });
    }
};
