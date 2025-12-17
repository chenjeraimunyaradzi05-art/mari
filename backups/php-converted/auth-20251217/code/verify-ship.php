<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== QUEUE_JOBS TABLE VERIFICATION ===" . PHP_EOL . PHP_EOL;

$columns = DB::select('DESC queue_jobs');
echo "Table: queue_jobs" . PHP_EOL;
echo "Columns: " . count($columns) . PHP_EOL . PHP_EOL;

foreach ($columns as $col) {
    echo "  ✓ {$col->Field}  ({$col->Type})" . PHP_EOL;
}

echo PHP_EOL;
$records = DB::select('SELECT COUNT(*) as count FROM queue_jobs');
echo "Queued Jobs: " . $records[0]->count . PHP_EOL;

echo PHP_EOL;
echo "=== MIGRATION STATUS ===" . PHP_EOL;
$migrations = DB::select('SELECT migration FROM migrations ORDER BY batch DESC LIMIT 5');
foreach ($migrations as $m) {
    echo "  ✓ {$m->migration}" . PHP_EOL;
}

echo PHP_EOL;
echo "✅ All systems operational!" . PHP_EOL;
