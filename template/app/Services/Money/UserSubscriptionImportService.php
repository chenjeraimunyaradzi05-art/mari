<?php

namespace App\Services\Money;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use SplFileObject;
use Throwable;

final class UserSubscriptionImportService
{
    /**
     * @return ((int|mixed)[]|mixed)[]
     *
     * @psalm-return array{stats: array{created: int, updated: int, unchanged: int, archived: 0|mixed}, warnings: mixed}
     */
    public function importFromCsv(User $user, string $path, bool $archiveMissing = false): array
    {
        [$rows, $warnings] = $this->parseSubscriptionCsvRows($path);

        if (empty($rows)) {
            $message = $warnings[0] ?? 'No subscription rows were detected in the provided CSV.';

            throw new RuntimeException($message);
        }

        $stats = [
            'created' => 0,
            'updated' => 0,
            'unchanged' => 0,
            'archived' => 0,
        ];
        $processedIds = [];

        DB::transaction(function () use ($user, $rows, $archiveMissing, &$stats, &$processedIds): void {
            foreach ($rows as $row) {
                $subscription = $user->subscriptions()->firstOrNew([
                    'label' => $row['label'],
                    'category' => $row['category'],
                ]);

                $subscription->monthly_amount = $row['monthly_amount'];
                $subscription->necessity_level = $row['necessity_level'];
                $subscription->is_active = true;
                $subscription->meta = $this->mergeSubscriptionMeta($subscription->meta ?? [], $row['meta']);

                $wasNew = ! $subscription->exists;
                $wasDirty = $subscription->isDirty();

                $subscription->save();
                $processedIds[] = $subscription->id;

                if ($subscription->wasRecentlyCreated || $wasNew) {
                    $stats['created']++;
                    continue;
                }

                if ($wasDirty || $subscription->wasChanged()) {
                    $stats['updated']++;
                } else {
                    $stats['unchanged']++;
                }
            }

            if ($archiveMissing) {
                $stats['archived'] = $user->subscriptions()
                    ->whereNotIn('id', $processedIds)
                    ->update(['is_active' => false]);
            }
        });

        return [
            'stats' => $stats,
            'warnings' => $warnings,
        ];
    }

    /**
     * @return (array|string)[][]
     *
     * @psalm-return list{list<non-empty-array>, list<non-empty-string>}
     */
    private function parseSubscriptionCsvRows(string $path): array
    {
        $rows = [];
        $warnings = [];
        $file = new SplFileObject($path);
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);

        $headers = null;
        $lineNumber = 0;

        foreach ($file as $line) {
            if ($line === null || $line === false || $line === [null]) {
                continue;
            }

            $lineNumber++;

            if ($headers === null) {
                $headers = $this->normaliseCsvHeaders($line);

                if (! $this->csvHeadersAreValid($headers)) {
                    return [[], ['CSV header must include at least "label" and "monthly_amount" columns.']];
                }

                continue;
            }

            if ($this->rowIsEmpty($line)) {
                continue;
            }

            $assoc = $this->combineHeadersWithRow($headers, $line);
            $normalised = $this->normaliseSubscriptionCsvRow($assoc);

            if ($normalised) {
                $rows[] = $normalised;
            } else {
                $warnings[] = sprintf('Skipped row %d: missing label or monthly amount.', $lineNumber);
            }
        }

        return [$rows, $warnings];
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<null|string>
     */
    private function normaliseCsvHeaders(array $rawHeaders): array
    {
        return array_map(function ($header) {
            if (! is_string($header)) {
                return null;
            }

            $sanitised = Str::of($header)
                ->replace("\u{FEFF}", '')
                ->lower()
                ->replaceMatches('/[^a-z0-9]+/', '_')
                ->trim('_')
                ->value();

            return $sanitised !== '' ? $sanitised : null;
        }, $rawHeaders);
    }

    private function csvHeadersAreValid(array $headers): bool
    {
        return in_array('label', $headers, true) && in_array('monthly_amount', $headers, true);
    }

    private function combineHeadersWithRow(array $headers, array $row): array
    {
        $row = array_pad($row, count($headers), null);
        $assoc = [];

        foreach ($headers as $index => $header) {
            if ($header === null) {
                continue;
            }

            $value = $row[$index] ?? null;

            if (is_string($value)) {
                $value = trim($value);
            }

            $assoc[$header] = $value;
        }

        return $assoc;
    }

    private function rowIsEmpty(array $row): bool
    {
        foreach ($row as $cell) {
            if (is_string($cell) && trim($cell) !== '') {
                return false;
            }

            if (is_numeric($cell)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return ((array|null|string)[]|float|int|string)[]|null
     *
     * @psalm-return array{label: string, monthly_amount: 0|float, category: string, necessity_level: string, meta: array<string, array|null|string>}|null
     */
    private function normaliseSubscriptionCsvRow(array $row): array|null
    {
        $label = Str::of((string) ($row['label'] ?? ''))->trim()->limit(255)->value();
        $amount = $this->parseCurrencyValue($row['monthly_amount'] ?? $row['amount'] ?? null);

        if ($label === '' || $amount === null) {
            return null;
        }

        $category = $this->normaliseSubscriptionCategory($row['category'] ?? null);
        $necessity = $this->normaliseNecessityLevel($row['necessity_level'] ?? $row['necessity'] ?? null);
        $provider = trim((string) ($row['provider'] ?? ''));
        $billingCycle = trim((string) ($row['billing_cycle'] ?? ''));
        $statusRaw = $row['status'] ?? ($row['state'] ?? 'active');
        $status = Str::of((string) $statusRaw)->snake()->value() ?: 'active';
        $notes = trim((string) ($row['notes'] ?? ''));
        $tags = $this->explodeTags($row['tags'] ?? $row['labels'] ?? null);
        $nextRenewal = null;

        if (! empty($row['next_renewal'])) {
            try {
                $nextRenewal = Carbon::parse($row['next_renewal'])->toDateString();
            } catch (Throwable) {
                $nextRenewal = null;
            }
        }

        $meta = array_filter([
            'provider' => $provider !== '' ? $provider : null,
            'billing_cycle' => $billingCycle !== '' ? $billingCycle : null,
            'status' => $status,
            'notes' => $notes !== '' ? $notes : null,
            'next_renewal' => $nextRenewal,
            'tags' => $tags,
            'source' => 'csv-import',
        ], function ($value) {
            if (is_array($value)) {
                return ! empty($value);
            }

            return $value !== null && $value !== '';
        });

        return [
            'label' => $label,
            'monthly_amount' => max(0, $amount),
            'category' => $category,
            'necessity_level' => $necessity,
            'meta' => $meta,
        ];
    }

    private function parseCurrencyValue(mixed $value): ?float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        if (! is_string($value)) {
            return null;
        }

        $sanitised = preg_replace('/[^0-9.\-]/', '', $value);

        if ($sanitised === '' || ! is_numeric($sanitised)) {
            return null;
        }

        return (float) $sanitised;
    }

    private function normaliseSubscriptionCategory(?string $raw): string
    {
        $categories = $this->subscriptionCategories();
        $value = Str::of((string) $raw)
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->value();

        $aliases = [
            'phone' => 'phone_plan',
            'mobile' => 'phone_plan',
            'cell' => 'phone_plan',
            'entertainment' => 'streaming',
            'tv' => 'streaming',
            'video' => 'streaming',
            'gym' => 'fitness',
            'wellbeing' => 'fitness',
            'transportation' => 'transport',
            'fuel' => 'transport',
            'rent' => 'housing',
            'mortgage' => 'housing',
            'saas' => 'software',
            'productivity' => 'software',
            'storage' => 'cloud',
            'backup' => 'cloud',
            'school' => 'education',
        ];

        if (in_array($value, $categories, true)) {
            return $value;
        }

        if (array_key_exists($value, $aliases)) {
            return $aliases[$value];
        }

        return 'other';
    }

    /**
     * @return string[]
     *
     * @psalm-return list{'phone_plan', 'internet', 'streaming', 'gaming', 'fitness', 'transport', 'insurance', 'housing', 'business', 'software', 'cloud', 'education', 'other'}
     */
    private function subscriptionCategories(): array
    {
        return [
            'phone_plan',
            'internet',
            'streaming',
            'gaming',
            'fitness',
            'transport',
            'insurance',
            'housing',
            'business',
            'software',
            'cloud',
            'education',
            'other',
        ];
    }

    private function normaliseNecessityLevel(?string $raw): string
    {
        $levels = ['need', 'nice_to_have', 'luxury'];
        $value = Str::of((string) $raw)
            ->lower()
            ->replace(' ', '_')
            ->trim('_')
            ->value();

        return in_array($value, $levels, true) ? $value : 'need';
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<int, null|string>
     */
    private function explodeTags(mixed $raw): array
    {
        if (is_array($raw)) {
            $candidates = $raw;
        } else {
            $candidates = preg_split('/[|,;]/', (string) $raw) ?: [];
        }

        return collect($candidates)
            ->map(fn ($tag) => is_string($tag) ? Str::of($tag)->lower()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_')->value() : null)
            ->filter(fn ($tag) => $tag !== null && $tag !== '')
            ->unique()
            ->values()
            ->all();
    }

    private function mergeSubscriptionMeta(array $existing, array $incoming): array
    {
        $existing = is_array($existing) ? $existing : [];
        $merged = array_replace($existing, $incoming);

        if (isset($merged['tags']) && is_array($merged['tags'])) {
            $merged['tags'] = array_values(array_unique(array_filter($merged['tags'], fn ($tag) => is_string($tag) && $tag !== '')));
        }

        return array_filter($merged, function ($value) {
            if (is_array($value)) {
                return ! empty($value);
            }

            return $value !== null && $value !== '';
        });
    }
}

