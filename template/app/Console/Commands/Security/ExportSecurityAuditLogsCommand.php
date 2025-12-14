<?php

namespace App\Console\Commands\Security;

use App\Models\SecurityAuditLog;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ExportSecurityAuditLogsCommand extends Command
{
    protected $signature = 'security:audit:export
        {--since= : Export only events created after this ISO timestamp}
        {--chunk= : Number of rows to stream at a time}
        {--force : Re-export events that have already been marked as exported}
        {--dry-run : Show what would be exported without writing a file or mutating data}';

    protected $description = 'Stream security audit logs to the configured SIEM/export sink.';

    /**
     * @return (\stdClass|array|int|null|string)[]
     *
     * @psalm-return array{id: int, user_id: int|null, event_type: string, severity: string, ip_address: null|string, user_agent: null|string, resource_type: null|string, resource_id: null|string, metadata: \stdClass|array, created_at: string, updated_at: string}
     */
    private function formatLog(SecurityAuditLog $log): array
    {
        return [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'event_type' => $log->event_type,
            'severity' => $log->severity,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'resource_type' => $log->resource_type,
            'resource_id' => $log->resource_id,
            'metadata' => $log->metadata ?? new \stdClass(),
            'created_at' => optional($log->created_at)->toIso8601String(),
            'updated_at' => optional($log->updated_at)->toIso8601String(),
        ];
    }
}

