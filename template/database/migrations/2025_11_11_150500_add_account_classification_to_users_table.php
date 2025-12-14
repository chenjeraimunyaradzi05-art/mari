<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'account_classification')) {
                $table->string('account_classification')->default('candidate')->after('role');
                $table->index('account_classification');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'account_classification')) {
                $table->dropIndex('users_account_classification_index');
                $table->dropColumn('account_classification');
            }
        });
    }
};
