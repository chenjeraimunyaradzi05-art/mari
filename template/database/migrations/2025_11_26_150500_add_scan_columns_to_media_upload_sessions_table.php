<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_upload_sessions', function (Blueprint $table) {
            if (! Schema::hasColumn('media_upload_sessions', 'scan_status')) {
                $table->string('scan_status', 40)->default('pending')->after('status');
            }

            if (! Schema::hasColumn('media_upload_sessions', 'scan_verdict')) {
                $table->string('scan_verdict', 40)->nullable()->after('scan_status');
            }

            if (! Schema::hasColumn('media_upload_sessions', 'scan_score')) {
                $table->unsignedInteger('scan_score')->nullable()->after('scan_verdict');
            }

            if (! Schema::hasColumn('media_upload_sessions', 'scan_labels')) {
                $table->json('scan_labels')->nullable()->after('scan_score');
            }

            if (! Schema::hasColumn('media_upload_sessions', 'scan_summary')) {
                $table->string('scan_summary', 500)->nullable()->after('scan_labels');
            }

            if (! Schema::hasColumn('media_upload_sessions', 'scan_attempted_at')) {
                $table->timestamp('scan_attempted_at')->nullable()->after('scan_summary');
            }

            if (! Schema::hasColumn('media_upload_sessions', 'scan_completed_at')) {
                $table->timestamp('scan_completed_at')->nullable()->after('scan_attempted_at');
            }

            if (! Schema::hasColumn('media_upload_sessions', 'scan_error')) {
                $table->string('scan_error', 500)->nullable()->after('scan_completed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('media_upload_sessions', function (Blueprint $table) {
            $columns = [
                'scan_status',
                'scan_verdict',
                'scan_score',
                'scan_labels',
                'scan_summary',
                'scan_attempted_at',
                'scan_completed_at',
                'scan_error',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('media_upload_sessions', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
