<?php

declare(strict_types=1);

namespace App\Console\Commands\WomenRealEstate;

use App\Models\WomenRealEstate\WomenAgentVerificationAudit;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Illuminate\Console\Command;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

final class WomenVerificationEncryptionAuditCommand extends Command
{
    protected $signature = 'women:verification:encryption-check {--fix : Encrypt any legacy plaintext payloads and audit notes}';

    protected $description = 'Audit women verification records to confirm sensitive payloads and audit notes are encrypted.';

    /**
     * @return int[]
     *
     * @psalm-return list{int<0, max>, int<0, max>}
     */
    private function auditAgents(bool $fix): array
    {
        $issues = 0;
        $fixed = 0;

        WomenVerifiedAgent::query()
            ->select(['id', 'verification_payload'])
            ->orderBy('id')
            ->chunkById(200, function ($agents) use ($fix, &$issues, &$fixed): void {
                foreach ($agents as $agent) {
                    $raw = $agent->getRawOriginal('verification_payload');

                    if ($raw === null || $this->isEncrypted($raw)) {
                        continue;
                    }

                    $issues++;

                    if (! $fix) {
                        $this->warn(sprintf('Agent %d has legacy plaintext verification payload.', $agent->id));
                        continue;
                    }

                    $payload = $agent->verification_payload;
                    $agent->verification_payload = $payload;
                    $agent->save();
                    $fixed++;
                }
            });

        return [$issues, $fixed];
    }

    /**
     * @return array{0:int,1:int}
     */
    private function auditAuditNotes(bool $fix): array
    {
        return $this->auditAuditColumn('notes', $fix);
    }

    /**
     * @return array{0:int,1:int}
     */
    private function auditAuditSummaries(bool $fix): array
    {
        return $this->auditAuditColumn('ai_summary', $fix);
    }

    /**
     * @return int[]
     *
     * @psalm-return list{int<0, max>, int<0, max>}
     */
    private function auditAuditColumn(string $column, bool $fix): array
    {
        $issues = 0;
        $fixed = 0;

        WomenAgentVerificationAudit::query()
            ->select(['id', $column])
            ->orderBy('id')
            ->chunkById(200, function ($audits) use ($column, $fix, &$issues, &$fixed): void {
                foreach ($audits as $audit) {
                    $raw = $audit->getRawOriginal($column);

                    if ($raw === null || $this->isEncrypted($raw)) {
                        continue;
                    }

                    $issues++;

                    if (! $fix) {
                        $this->warn(sprintf('Audit %d has legacy plaintext %s.', $audit->id, str_replace('_', ' ', $column)));
                        continue;
                    }

                    $value = $audit->{$column};
                    $audit->{$column} = $value;
                    $audit->save();
                    $fixed++;
                }
            });

        return [$issues, $fixed];
    }

    private function isEncrypted(mixed $value): bool
    {
        if (! is_string($value) || $value === '') {
            if (is_array($value)) {
                return $this->isEnvelope($value);
            }

            return false;
        }

        try {
            Crypt::decryptString($value);

            return true;
        } catch (DecryptException) {
            $decoded = json_decode($value, true);

            if (! is_array($decoded)) {
                return false;
            }

            return $this->isEnvelope($decoded);
        }
    }

    private function isEnvelope(array $value): bool
    {
        if (! isset($value['_encrypted'], $value['ciphertext']) || $value['_encrypted'] !== true || ! is_string($value['ciphertext'])) {
            return false;
        }

        try {
            Crypt::decryptString($value['ciphertext']);

            return true;
        } catch (DecryptException) {
            return false;
        }
    }
}

