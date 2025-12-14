<?php

namespace App\Services\Performance;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class QueryOptimizationService
{
    public function analyzeSlowQueries(): Collection
    {
        try {
            // Enable slow query log analysis
            // Note: This requires access to the mysql.slow_log table which might be restricted
            // or the slow query log might not be enabled in the DB config.
            $slowQueries = DB::select("
                SELECT query_time, lock_time, rows_examined, rows_sent, sql_text
                FROM mysql.slow_log
                WHERE query_time > 1
                ORDER BY query_time DESC
                LIMIT 100
            ");

            return collect($slowQueries);
        } catch (\Exception $e) {
            // Fallback or return empty if table doesn't exist or access denied
            return collect([]);
        }
    }

    /**
     * @return array[]
     *
     * @psalm-return array<array>
     */
    public function suggestIndexes(): array
    {
        $suggestions = [];

        // Analyze missing indexes
        $tables = DB::select("SHOW TABLES");
        $dbName = DB::connection()->getDatabaseName();

        foreach ($tables as $table) {
            $tableName = array_values((array)$table)[0];

            // Check for columns frequently used in WHERE without indexes
            // This is a heuristic approach. We look for common foreign keys or status columns
            // that are not indexed.

            $unindexedColumns = DB::select("
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = ?
                AND COLUMN_NAME NOT IN (
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.STATISTICS
                    WHERE TABLE_SCHEMA = ?
                    AND TABLE_NAME = ?
                )
                AND COLUMN_NAME IN ('user_id', 'created_at', 'status', 'country_code', 'type', 'category', 'slug')
            ", [$dbName, $tableName, $dbName, $tableName]);

            if (!empty($unindexedColumns)) {
                $suggestions[$tableName] = collect($unindexedColumns)->pluck('COLUMN_NAME')->toArray();
            }
        }

        return $suggestions;
    }
}

