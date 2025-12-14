<?php

namespace App\Console\Commands;

use App\Services\Performance\QueryOptimizationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class OptimizeDatabaseCommand extends Command
{
    protected $signature = 'optimize:database';
    protected $description = 'Analyze and optimize database performance';

    public function handle(): void
    {
        $this->info('Analyzing database performance...');

        // 1. Find missing indexes
        $optimizer = app(QueryOptimizationService::class);
        $indexSuggestions = $optimizer->suggestIndexes();

        if (!empty($indexSuggestions)) {
            $this->warn('Missing indexes detected:');
            foreach ($indexSuggestions as $table => $columns) {
                $this->line("  {$table}: " . implode(', ', $columns));
            }
        } else {
            $this->info('No obvious missing indexes found for common columns.');
        }

        // 2. Analyze slow queries
        $slowQueries = $optimizer->analyzeSlowQueries();
        if ($slowQueries->count() > 0) {
            $this->warn("Found {$slowQueries->count()} slow queries (>1s)");
            $this->line($slowQueries->take(5)->pluck('sql_text')->implode("\n"));
        } else {
            $this->info('No slow queries found (or slow log not accessible).');
        }

        // 3. Optimize tables
        $this->info('Optimizing tables...');
        $tables = DB::select("SHOW TABLES");
        $bar = $this->output->createProgressBar(count($tables));

        foreach ($tables as $table) {
            $tableName = array_values((array)$table)[0];
            try {
                DB::statement("OPTIMIZE TABLE `{$tableName}`");
            } catch (\Exception $e) {
                // Ignore errors for views or unsupported engines
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Database optimization complete!');
    }
}

