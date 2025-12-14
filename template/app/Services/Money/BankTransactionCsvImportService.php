<?php

namespace App\Services\Money;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use SplFileObject;
use Throwable;

final class BankTransactionCsvImportService
{
    /**
     * @return ((int|string)[]|mixed)[]
     *
     * @psalm-return array{stats: array{created: int, updated: int, unchanged: int, skipped: int}, warnings: list{string,...}|mixed}
     */
    public function importFromCsv(User $user, string $path, ?BankAccount $defaultAccount = null, array $options = []): array
    {
        $options = array_merge([
            'default_status' => BankTransaction::STATUS_PENDING,
            'auto_create_accounts' => true,
        ], $options);

        [$rows, $warnings] = $this->parseCsv($path);

        if (empty($rows)) {
            throw new RuntimeException($warnings[0] ?? 'No bank transactions were detected in the uploaded CSV.');
        }

        $stats = [
            'created' => 0,
            'updated' => 0,
            'unchanged' => 0,
            'skipped' => 0,
        ];

        $accounts = $user->bankAccounts()->get();
        $accountLookup = $this->buildAccountLookup($accounts);

        DB::transaction(function () use ($user, $rows, $defaultAccount, $options, &$stats, &$warnings, &$accounts, &$accountLookup): void {
            foreach ($rows as $row) {
                $account = $this->resolveAccount($user, $row, $defaultAccount, $accounts, $accountLookup, $options);

                if (! $account) {
                    $stats['skipped']++;
                    $warnings[] = sprintf('Row %d skipped: unable to resolve or create a bank account.', $row['line']);
                    continue;
                }

                if (! $row['posted_at'] || $row['amount'] === null || $row['description'] === '') {
                    $stats['skipped']++;
                    $warnings[] = sprintf('Row %d skipped: missing date, description, or amount.', $row['line']);
                    continue;
                }

                $status = $this->normaliseStatus($row['status'] ?? $options['default_status']);
                $category = $this->normaliseCategory($row['category_key'] ?? null);
                $isFlagged = (bool) ($row['flagged'] ?? false);
                $metadata = $this->mergeMetadata($row['metadata'] ?? [], [
                    'import' => array_filter([
                        'source' => 'csv',
                        'line' => $row['line'],
                        'import_id' => $row['import_id'] ?? null,
                    ]),
                ]);

                $transaction = BankTransaction::query()->firstOrNew([
                    'user_id' => $user->id,
                    'bank_account_id' => $account->id,
                    'posted_at' => $row['posted_at'],
                    'description' => $row['description'],
                    'amount_cents' => (int) round($row['amount'] * 100),
                    'direction' => $row['direction'] ?? 'debit',
                ]);

                $transaction->reference = $row['reference'] ?? null;
                $transaction->status = $status;
                $transaction->category_key = $category;
                $transaction->is_flagged = $isFlagged;
                $transaction->metadata = $metadata;

                if (! empty($row['amount'])) {
                    $transaction->amount = $row['amount'];
                }

                $transaction->save();

                if ($transaction->wasRecentlyCreated) {
                    $stats['created']++;
                } elseif ($transaction->wasChanged()) {
                    $stats['updated']++;
                } else {
                    $stats['unchanged']++;
                }
            }
        });

        return [
            'stats' => $stats,
            'warnings' => $warnings,
        ];
    }

    /**
     * @return array[]
     *
     * @psalm-return list{list<non-empty-mixed>, list<non-empty-mixed>}
     */
    private function parseCsv(string $path): array
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
                $headers = $this->normaliseHeaders($line);
                continue;
            }

            if ($this->rowIsEmpty($line)) {
                continue;
            }

            $assoc = $this->combineHeadersWithRow($headers, $line);
            [$normalised, $warning] = $this->normaliseRow($assoc, $lineNumber);

            if ($warning) {
                $warnings[] = $warning;
            }

            if ($normalised) {
                $rows[] = $normalised;
            }
        }

        return [$rows, $warnings];
    }

    /**
     * @return ((array|bool|int|mixed|null|string)[]|null|string)[]
     *
     * @psalm-return list{array{line: int, posted_at: null|string, description: string, reference: null|string, amount: mixed, direction: mixed, status: string, category_key: null|string, flagged: bool, account_name: null|string, institution: null|string, import_id: null|string, metadata: array<never, never>}|null, null|string}
     */
    private function normaliseRow(array $row, int $lineNumber): array
    {
        $description = Str::of((string) ($row['description'] ?? $row['details'] ?? $row['memo'] ?? ''))
            ->trim()
            ->limit(255)
            ->value();

        $postedAt = $this->parseDate($row['posted_at'] ?? $row['date'] ?? null);
        [$amount, $direction] = $this->extractAmountAndDirection($row);

        if ($description === '' && $amount === null && ! $postedAt) {
            return [null, sprintf('Row %d skipped: missing usable fields.', $lineNumber)];
        }

        $reference = Str::of((string) ($row['reference'] ?? $row['memo'] ?? $row['note'] ?? ''))
            ->trim()
            ->limit(120)
            ->value();

        $accountName = Str::of((string) ($row['account_name'] ?? $row['account'] ?? $row['account_label'] ?? ''))
            ->trim()
            ->limit(160)
            ->value();

        $institution = Str::of((string) ($row['institution'] ?? $row['bank'] ?? ''))
            ->trim()
            ->limit(160)
            ->value();

        $status = Str::of((string) ($row['status'] ?? ''))
            ->trim()
            ->lower()
            ->value();

        $category = Str::of((string) ($row['category_key'] ?? $row['category'] ?? ''))
            ->trim()
            ->limit(80)
            ->value();

        $flagged = $this->toBoolean($row['flagged'] ?? $row['is_flagged'] ?? null);
        $importId = Str::of((string) ($row['import_id'] ?? $row['id'] ?? ''))
            ->trim()
            ->limit(60)
            ->value();

        return [[
            'line' => $lineNumber,
            'posted_at' => $postedAt,
            'description' => $description,
            'reference' => $reference !== '' ? $reference : null,
            'amount' => $amount,
            'direction' => $direction,
            'status' => $status,
            'category_key' => $category !== '' ? $category : null,
            'flagged' => $flagged,
            'account_name' => $accountName !== '' ? $accountName : null,
            'institution' => $institution !== '' ? $institution : null,
            'import_id' => $importId !== '' ? $importId : null,
            'metadata' => [],
        ], null];
    }

    /**
     * @return (float|null|string)[]
     *
     * @psalm-return list{float|null, null|string}
     */
    private function extractAmountAndDirection(array $row): array
    {
        $candidates = [
            $row['amount'] ?? null,
            $row['value'] ?? null,
        ];

        if (! empty($row['credit'])) {
            $credit = $this->parseMoney($row['credit']);
            if ($credit !== null) {
                return [$credit, 'credit'];
            }
        }

        if (! empty($row['debit'])) {
            $debit = $this->parseMoney($row['debit']);
            if ($debit !== null) {
                return [$debit, 'debit'];
            }
        }

        foreach ($candidates as $candidate) {
            $parsed = $this->parseMoney($candidate);

            if ($parsed === null) {
                continue;
            }

            $direction = $this->normaliseDirection($row['direction'] ?? null, $parsed);

            return [abs($parsed), $direction];
        }

        return [null, null];
    }

    private function parseMoney(mixed $value): ?float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        $sanitised = preg_replace('/[^0-9.\-]/', '', $value);

        if ($sanitised === '' || ! is_numeric($sanitised)) {
            return null;
        }

        return (float) $sanitised;
    }

    private function parseDate(mixed $value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (Throwable) {
            return null;
        }
    }

    private function toBoolean(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        if (is_string($value)) {
            $normalised = Str::of($value)->lower()->trim()->value();

            return in_array($normalised, ['1', 'true', 'yes', 'y', 'flagged'], true);
        }

        return false;
    }

    private function normaliseStatus(?string $status): string
    {
        $status = Str::of((string) $status)
            ->lower()
            ->trim()
            ->value();

        return match ($status) {
            BankTransaction::STATUS_MATCHED => BankTransaction::STATUS_MATCHED,
            BankTransaction::STATUS_EXCLUDED => BankTransaction::STATUS_EXCLUDED,
            default => BankTransaction::STATUS_PENDING,
        };
    }

    private function normaliseCategory(?string $category): string|null
    {
        if ($category === null) {
            return null;
        }

        $value = Str::of($category)
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->limit(80)
            ->value();

        return $value !== '' ? $value : null;
    }

    private function normaliseDirection(mixed $direction, float $amount): string
    {
        if (is_string($direction)) {
            $normalised = Str::of($direction)->lower()->trim()->value();

            if (in_array($normalised, ['credit', 'debit'], true)) {
                return $normalised;
            }
        }

        return $amount < 0 ? 'debit' : ($amount > 0 ? 'credit' : 'debit');
    }

    private function mergeMetadata(mixed $existing, array $incoming): array
    {
        $existing = is_array($existing) ? $existing : [];
        $merged = array_replace_recursive($existing, $incoming);

        return array_filter($merged, function ($value) {
            if (is_array($value)) {
                return ! empty(array_filter($value, fn ($entry) => $entry !== null && $entry !== ''));
            }

            return $value !== null && $value !== '';
        });
    }

    /**
     * @psalm-return array<string, mixed>
     */
    private function buildAccountLookup(Collection $accounts): array
    {
        $lookup = [];

        foreach ($accounts as $account) {
            $key = $this->normaliseAccountKey($account->account_name);

            if ($key !== '') {
                $lookup[$key] = $account;
            }
        }

        return $lookup;
    }

    private function resolveAccount(User $user, array $row, ?BankAccount $defaultAccount, Collection $accounts, array &$lookup, array $options): ?BankAccount
    {
        $name = $row['account_name'] ?? null;
        $key = $name ? $this->normaliseAccountKey($name) : null;

        if ($key && isset($lookup[$key])) {
            return $lookup[$key];
        }

        if ($key && ! empty($options['auto_create_accounts']) && $name) {
            $created = $this->createAccount($user, $name, $row['institution'] ?? null);
            $accounts->push($created);
            $lookup[$this->normaliseAccountKey($created->account_name)] = $created;

            return $created;
        }

        if ($defaultAccount) {
            return $defaultAccount;
        }

        if ($accounts->isNotEmpty()) {
            return $accounts->first();
        }

        if (! empty($options['auto_create_accounts'])) {
            $created = $this->createAccount($user, $name, $row['institution'] ?? null);
            $accounts->push($created);
            $lookup[$this->normaliseAccountKey($created->account_name)] = $created;

            return $created;
        }

        return null;
    }

    private function createAccount(User $user, ?string $name, ?string $institution): BankAccount
    {
        $account = BankAccount::query()->create([
            'user_id' => $user->id,
            'account_name' => $name && trim($name) !== '' ? Str::limit($name, 160) : 'Imported account',
            'institution' => $institution && trim($institution) !== '' ? Str::limit($institution, 160) : 'CSV import',
            'account_type' => 'csv_import',
            'currency' => 'AUD',
        ]);

        return $account;
    }

    private function normaliseAccountKey(?string $value): string
    {
        if ($value === null) {
            return '';
        }

        return Str::of($value)->lower()->trim()->value();
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array<null|string>
     */
    private function normaliseHeaders(array $headers): array
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
        }, $headers);
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
}

