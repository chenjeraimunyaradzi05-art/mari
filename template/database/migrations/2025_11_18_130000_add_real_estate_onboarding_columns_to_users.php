<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'real_estate_entry_path')) {
                $table->string('real_estate_entry_path', 50)->nullable()->after('account_classification');
            }

            if (! Schema::hasColumn('users', 'real_estate_financing_plan')) {
                $table->string('real_estate_financing_plan', 50)->nullable()->after('real_estate_entry_path');
            }

            if (! Schema::hasColumn('users', 'real_estate_onboarded_at')) {
                $table->timestamp('real_estate_onboarded_at')->nullable()->after('real_estate_financing_plan');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'real_estate_onboarded_at')) {
                $table->dropColumn('real_estate_onboarded_at');
            }

            if (Schema::hasColumn('users', 'real_estate_financing_plan')) {
                $table->dropColumn('real_estate_financing_plan');
            }

            if (Schema::hasColumn('users', 'real_estate_entry_path')) {
                $table->dropColumn('real_estate_entry_path');
            }
        });
    }
};
