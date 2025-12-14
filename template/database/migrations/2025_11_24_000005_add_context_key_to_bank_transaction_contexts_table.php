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
            $table->string('context_key', 80)->default('bank-feed-triage')->after('surface');
            $table->index('context_key');
        });

        DB::table('bank_transaction_contexts')
            ->whereNull('context_key')
            ->update(['context_key' => 'bank-feed-triage']);
    }

    public function down(): void
    {
        Schema::table('bank_transaction_contexts', function (Blueprint $table): void {
            $table->dropIndex('bank_transaction_contexts_context_key_index');
            $table->dropColumn('context_key');
        });
    }
};
