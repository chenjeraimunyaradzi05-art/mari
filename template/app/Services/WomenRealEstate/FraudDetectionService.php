<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Models\WomenRealEstate\WomenVerifiedAgent;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class FraudDetectionService
{
    /**
     * Analyse the submission and return a fraud heuristic score with supporting signals.
     *
     * @return ((float|int|null|string|string[])[]|float)[]
     *
     * @psalm-return array{score: float, flags: list<'duplicate_license_detected'|'license_expired'|'missing_required_documents'|'name_mismatch'>, signals: array{duplicate_license_records: int, name_similarity: float|null, missing_documents: array<int, string>, license_expires_at?: null|string}}
     */
    public function analyse(WomenVerifiedAgent $agent): array
    {
        $flags = [];
        $score = 0.0;
        $signals = [];

        $duplicateCount = $this->duplicateLicenseCount($agent);
        $signals['duplicate_license_records'] = $duplicateCount;
        if ($duplicateCount > 0) {
            $flags[] = 'duplicate_license_detected';
            $score += 0.35;
        }

        $nameSimilarity = $this->nameSimilarity($agent);
        $signals['name_similarity'] = $nameSimilarity;
        if ($nameSimilarity !== null && $nameSimilarity < 0.4) {
            $flags[] = 'name_mismatch';
            $score += 0.25;
        }

        $missingDocuments = $this->missingRequiredDocuments($agent);
        $signals['missing_documents'] = $missingDocuments;
        if ($missingDocuments !== []) {
            $flags[] = 'missing_required_documents';
            $score += 0.2;
        }

        if ($agent->license_expires_at !== null) {
            $expiry = CarbonImmutable::make($agent->license_expires_at);
            $signals['license_expires_at'] = $expiry?->toIso8601String();
            if ($expiry !== null && $expiry->isPast()) {
                $flags[] = 'license_expired';
                $score += 0.2;
            }
        }

        $score = min(1.0, round($score, 2));
        $flags = array_values(array_unique($flags));

        return [
            'score' => $score,
            'flags' => $flags,
            'signals' => $signals,
        ];
    }

    private function duplicateLicenseCount(WomenVerifiedAgent $agent): int
    {
        if (! $agent->license_number) {
            return 0;
        }

        return (int) WomenVerifiedAgent::query()
            ->where('license_number', $agent->license_number)
            ->when($agent->exists, fn ($query) => $query->where('id', '!=', $agent->getKey()))
            ->count();
    }

    private function nameSimilarity(WomenVerifiedAgent $agent): ?float
    {
        $userName = Str::lower(trim((string) ($agent->user?->name ?? '')));
        $legalName = Str::lower(trim((string) Arr::get($agent->verification_payload, 'application.profile.legal_name', '')));

        if ($userName === '' || $legalName === '') {
            return null;
        }

        similar_text($userName, $legalName, $percent);

        return round($percent / 100, 2);
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, 'license_certificate'|'photo_id'>
     */
    private function missingRequiredDocuments(WomenVerifiedAgent $agent): array
    {
        $documents = Arr::get($agent->verification_payload, 'application.documents', []);
        $required = ['license_certificate', 'photo_id'];

        return collect($required)
            ->filter(fn (string $key) => empty(Arr::get($documents, $key.'.path')))
            ->values()
            ->all();
    }
}

