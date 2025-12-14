<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'primary_role')) {
                $table->enum('primary_role', [
                    'member',
                    'company',
                    'mentor',
                    'public_sector',
                    'tafe_university',
                    'business_network',
                    'real_estate_agent',
                    'real_estate_seeker',
                    'trades_professional',
                    'health_wellness_provider',
                    'beauty_fashion_provider',
                    'financial_advisor',
                    'sole_trader',
                ])->default('member')->after('role');
            }

            if (! Schema::hasColumn('users', 'secondary_roles')) {
                $table->json('secondary_roles')->nullable()->after('primary_role');
            }

            if (! Schema::hasColumn('users', 'bio')) {
                $table->text('bio')->nullable()->after('persona_flags');
            }

            if (! Schema::hasColumn('users', 'location')) {
                $table->string('location')->nullable()->after('bio');
            }

            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 20)->nullable()->after('location');
            }

            if (! Schema::hasColumn('users', 'interests')) {
                $table->json('interests')->nullable()->after('phone');
            }

            if (! Schema::hasColumn('users', 'skills')) {
                $table->json('skills')->nullable()->after('interests');
            }

            if (! Schema::hasColumn('users', 'preferences')) {
                $table->json('preferences')->nullable()->after('skills');
            }

            if (! Schema::hasColumn('users', 'profile_completion_percentage')) {
                $table->unsignedInteger('profile_completion_percentage')->default(20)->after('preferences');
            }

            if (! Schema::hasColumn('users', 'profile_completed')) {
                $table->boolean('profile_completed')->default(false)->after('profile_completion_percentage');
            }

            if (! Schema::hasColumn('users', 'first_login')) {
                $table->boolean('first_login')->default(true)->after('profile_completed');
            }

            if (! Schema::hasColumn('users', 'onboarding_completed')) {
                $table->boolean('onboarding_completed')->default(false)->after('first_login');
            }

            if (! Schema::hasColumn('users', 'onboarding_completed_at')) {
                $table->timestamp('onboarding_completed_at')->nullable()->after('onboarding_completed');
            }

            if (! Schema::hasColumn('users', 'avatar_path')) {
                $table->string('avatar_path')->nullable()->after('onboarding_completed_at');
            }

            if (! Schema::hasColumn('users', 'is_verified')) {
                $table->boolean('is_verified')->default(false)->after('avatar_path');
            }

            if (! Schema::hasColumn('users', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('is_verified');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            $columns = [
                'primary_role',
                'secondary_roles',
                'bio',
                'location',
                'phone',
                'interests',
                'skills',
                'preferences',
                'profile_completion_percentage',
                'profile_completed',
                'first_login',
                'onboarding_completed',
                'onboarding_completed_at',
                'avatar_path',
                'is_verified',
                'verified_at',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
