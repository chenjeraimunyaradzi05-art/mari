<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $driver = DB::getDriverName();

            if ($driver === 'sqlite') {
                $table->string('onboarding_step')->default('welcome');
            } else {
                $table->enum('onboarding_step', ['welcome', 'profile', 'roles', 'completed'])->default('welcome');
            }
            $table->json('persona_flags')->nullable();
            $table->string('pronouns')->nullable();
            $table->string('preferred_name')->nullable();
            $table->string('timezone')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['onboarding_step', 'persona_flags', 'pronouns', 'preferred_name', 'timezone']);
        });
    }
};
