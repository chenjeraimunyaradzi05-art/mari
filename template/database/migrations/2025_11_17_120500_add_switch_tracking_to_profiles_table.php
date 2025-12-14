<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('profiles')) {
            return;
        }

        Schema::table('profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('profiles', 'last_switched_at')) {
                $table->timestamp('last_switched_at')->nullable()->after('is_active');
            }

            if (! Schema::hasColumn('profiles', 'switch_context')) {
                $table->string('switch_context', 50)->nullable()->after('last_switched_at');
            }

            $table->index(['user_id', 'last_switched_at']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('profiles')) {
            return;
        }

        Schema::table('profiles', function (Blueprint $table) {
            if (Schema::hasColumn('profiles', 'switch_context')) {
                $table->dropColumn('switch_context');
            }

            if (Schema::hasColumn('profiles', 'last_switched_at')) {
                $table->dropColumn('last_switched_at');
            }
        });
    }
};
