<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('security_audit_logs', function (Blueprint $table) {
            $table->timestamp('exported_at')->nullable()->after('metadata');
            $table->string('export_batch_id')->nullable()->after('exported_at');

            $table->index(['exported_at', 'id'], 'security_audit_logs_exported_idx');
        });
    }

    public function down(): void
    {
        Schema::table('security_audit_logs', function (Blueprint $table) {
            $table->dropIndex('security_audit_logs_exported_idx');
            $table->dropColumn(['exported_at', 'export_batch_id']);
        });
    }
};
