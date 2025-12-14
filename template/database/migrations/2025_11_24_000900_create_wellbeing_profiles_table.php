<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('wellbeing_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('movement_level')->nullable();
            $table->boolean('pref_yoga')->default(false);
            $table->boolean('pref_running')->default(false);
            $table->boolean('pref_strength')->default(false);
            $table->boolean('pref_team_sport')->default(false);
            $table->boolean('pref_outdoors')->default(false);
            $table->boolean('pref_meditation')->default(false);
            $table->boolean('pref_vipassana')->default(false);
            $table->text('goals')->nullable();
            $table->text('constraints')->nullable();
            $table->text('health_topics')->nullable();
            $table->string('availability')->nullable();
            $table->string('energy_pattern')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wellbeing_profiles');
    }
};
