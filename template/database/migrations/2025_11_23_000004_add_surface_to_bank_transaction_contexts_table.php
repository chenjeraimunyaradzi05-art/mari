<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bank_transaction_contexts', function (Blueprint $table): void {
            $table->string('surface', 64)->nullable()->after('context_payload');
            $table->index('surface');
        });

        DB::table('bank_transaction_contexts')
            ->whereNull('surface')
            ->update(['surface' => 'money_budget']);
    }

    public function down(): void
    {
        Schema::table('bank_transaction_contexts', function (Blueprint $table): void {
            $table->dropIndex('bank_transaction_contexts_surface_index');
            $table->dropColumn('surface');
        });
    }
};
