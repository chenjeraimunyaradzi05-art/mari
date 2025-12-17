<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('admins', function (Blueprint $table) {
            if (!Schema::hasColumn('admins', 'auth0_sub')) {
                $table->string('auth0_sub')->nullable()->unique()->after('email');
            }

            $table->timestamp('auth0_last_login_at')->nullable()->after('auth0_sub');
            $table->timestamp('auth0_session_refreshed_at')->nullable()->after('auth0_last_login_at');
            $table->timestamp('mfa_verified_at')->nullable()->after('auth0_session_refreshed_at');
            $table->json('auth0_profile')->nullable()->after('mfa_verified_at');
            $table->string('last_login_ip', 64)->nullable()->after('auth0_profile');
            $table->text('last_login_user_agent')->nullable()->after('last_login_ip');
        });
    }

    public function down(): void
    {
        Schema::table('admins', function (Blueprint $table) {
            $columns = [
                'auth0_sub',
                'auth0_last_login_at',
                'auth0_session_refreshed_at',
                'mfa_verified_at',
                'auth0_profile',
                'last_login_ip',
                'last_login_user_agent',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('admins', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
