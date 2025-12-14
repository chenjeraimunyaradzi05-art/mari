<?php

namespace App\Services\Analytics;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

final class DataWarehouseExporter
{

    private string $analyticsPath;
    private string $payoutPath;
    private string $disk;

    public function __construct(?string $analyticsPath = null, ?string $payoutPath = null, ?string $disk = null)
    {
        // Allow overriding via constructor for tests, otherwise fall back to config/defaults
        $this->analyticsPath = $analyticsPath ?? config('analytics.export.path', 'analytics');
        $this->payoutPath = $payoutPath ?? config('analytics.export.payouts_path', 'payouts');
        $this->disk = $disk ?? config('analytics.export.disk', config('filesystems.default', 'local'));
    }


    public function exportAnalyticsEvents(Collection $events): string|null
    {
        if ($events->isEmpty()) {
            return null;
        }

        $path = sprintf('%s/events-%s.json', rtrim($this->analyticsPath, '/'), now()->format('Ymd_His'));
        Storage::disk($this->disk)->put($path, $this->formatPayload($events));

        return $path;
    }

    public function exportPayoutSummary(Collection $batches): string|null
    {
        if ($batches->isEmpty()) {
            return null;
        }

        $path = sprintf('%s/payouts-%s.json', rtrim($this->payoutPath, '/'), now()->format('Ymd_His'));
        Storage::disk($this->disk)->put($path, $this->formatPayload($batches));

        return $path;
    }

    private function formatPayload(Collection $data): string
    {
        return $data->values()->map(function ($model) {
            if (method_exists($model, 'toArray')) {
                return $model->toArray();
            }

            return (array) $model;
        })->toJson(JSON_PRETTY_PRINT);
    }
}

