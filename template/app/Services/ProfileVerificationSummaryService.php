<?php

namespace App\Services;

use App\Enums\ProfileVerificationStatus;
use App\Models\ProfileVerification;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

final class ProfileVerificationSummaryService
{
    /**
     * @return (array|float|int|null|string)[]
     *
     * @psalm-return array{version: 'v1', generated_at: string, overview: string, document_count: int, document_types: array, risk_score: float|null, risk_level: string, flags: array, recommendations: array}
     */
    public function build(ProfileVerification $verification): array
    {
        $documents = $verification->relationLoaded('documents')
            ? $verification->documents
            : $verification->documents()->get();

        $documentTypes = $this->extractDocumentTypes($documents);
        $flags = $this->formatFlags($verification->fraud_flags ?? []);
        $riskScore = $verification->risk_score !== null ? (float) $verification->risk_score : null;

        return [
            'version' => 'v1',
            'generated_at' => now()->toIso8601String(),
            'overview' => $this->buildOverview($verification, $documents->count()),
            'document_count' => $documents->count(),
            'document_types' => $documentTypes,
            'risk_score' => $riskScore,
            'risk_level' => $this->resolveRiskLevel($riskScore),
            'flags' => $flags,
            'recommendations' => $this->recommendations($verification, $flags),
        ];
    }

    /**
     * @return (false|string)[]
     *
     * @psalm-return array<int, false|string>
     */
    private function extractDocumentTypes(Collection $documents): array
    {
        return $documents
            ->map(function ($document) {
                $field = Arr::get($document->metadata, 'field');
                if (is_string($field) && $field !== '') {
                    return $field;
                }

                if (is_string($document->mime_type) && $document->mime_type !== '') {
                    return strtok($document->mime_type, '/');
                }

                return 'document';
            })
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function formatFlags(array $flags): array
    {
        return collect($flags)
            ->map(fn ($flag) => (string) $flag)
            ->map(fn ($flag) => str_replace('_', ' ', strtolower($flag)))
            ->unique()
            ->values()
            ->all();
    }

    private function buildOverview(ProfileVerification $verification, int $documentsCount): string
    {
        $persona = $verification->profile?->display_name ?? 'The persona';
        $method = ucwords(str_replace('_', ' ', $verification->request_type));
        $submittedAt = optional($verification->submitted_at)
            ? $verification->submitted_at->timezone(config('app.timezone'))->format('M j, Y g:i a T')
            : 'recently';

        return sprintf(
            '%s submitted a %s verification with %d document%s on %s.',
            $persona,
            $method,
            $documentsCount,
            $documentsCount === 1 ? '' : 's',
            $submittedAt
        );
    }

    private function resolveRiskLevel(?float $riskScore): string
    {
        if ($riskScore === null) {
            return 'unknown';
        }

        if ($riskScore >= 0.7) {
            return 'high';
        }

        if ($riskScore >= 0.45) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0: string, 1?: 'Verify license validity or request updated credentials.'}
     */
    private function recommendations(ProfileVerification $verification, array $flags): array
    {
        $recommendations = [];

        if (in_array('missing documents', $flags, true)) {
            $recommendations[] = 'Request the missing documents before approval.';
        }

        if (in_array('license expired', $flags, true) || $this->licenseExpiringSoon($verification)) {
            $recommendations[] = 'Verify license validity or request updated credentials.';
        }

        if ($verification->status === ProfileVerificationStatus::Pending && $recommendations === []) {
            $recommendations[] = 'Proceed with reviewer checklist; no blockers detected.';
        }

        if ($recommendations === []) {
            $recommendations[] = 'Monitoring only; no action required.';
        }

        return $recommendations;
    }

    private function licenseExpiringSoon(ProfileVerification $verification): bool
    {
        if ($verification->license_expires_at === null) {
            return false;
        }

        return now()->diffInDays($verification->license_expires_at, false) <= 30;
    }
}

