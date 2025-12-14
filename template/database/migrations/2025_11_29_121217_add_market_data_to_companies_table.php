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
        Schema::table('companies', function (Blueprint $table) {
            $table->decimal('stock_price', 10, 2)->nullable()->after('foundation_social_links');
            $table->decimal('market_cap', 15, 2)->nullable()->after('stock_price');
            $table->decimal('daily_change_percentage', 5, 2)->nullable()->after('market_cap');
            $table->timestamp('last_market_update')->nullable()->after('daily_change_percentage');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['stock_price', 'market_cap', 'daily_change_percentage', 'last_market_update']);
        });
    }
};
