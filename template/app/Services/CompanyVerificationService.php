<?php

namespace App\Services;

use App\Enums\CompanyVerificationStatus;
use App\Models\Company;
use App\Models\CompanyVerification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

final class CompanyVerificationService
{
	/**
	 * Submit a company verification request and persist audit records.
	 */
	public function submit(Company $company, array $payload): CompanyVerification
	{
		$now = now();

		$documents = $this->storeDocuments(
			$company,
			Arr::wrap($payload['documents'] ?? [])
		);

		return DB::transaction(function () use ($company, $payload, $documents, $now) {
			$verification = $company->verifications()->create([
				'status' => CompanyVerificationStatus::UnderReview,
				'documents' => $documents,
				'notes' => $payload['notes'] ?? null,
				'submitted_at' => $now,
				'source' => $payload['source'] ?? 'dashboard',
				'metadata' => $payload['metadata'] ?? null,
			]);

			$companyUpdates = [
				'verification_status' => CompanyVerificationStatus::UnderReview,
				'verification_submitted_at' => $now,
				'verification_source' => $payload['source'] ?? ($company->verification_source ?? 'dashboard'),
				'verified_at' => null,
				'verification_admin_id' => null,
			];

			foreach (['abn', 'asic_number', 'website', 'domain'] as $attribute) {
				if (array_key_exists($attribute, $payload)) {
					$companyUpdates[$attribute] = $payload[$attribute];
				}
			}

			if (array_key_exists('notes', $payload)) {
				$companyUpdates['verification_notes'] = $payload['notes'];
			}

			if (array_key_exists('metadata', $payload)) {
				$companyUpdates['verification_payload'] = $payload['metadata'];
			}

			$company->fill($companyUpdates)->save();

			return $verification;
		});
	}

	/**
	 * Persist uploaded verification documents and return their storage paths.
	 *
	 * @return (false|string)[]
	 *
	 * @psalm-return array<int, false|string>
	 */
	protected function storeDocuments(Company $company, array $documents): array
	{
		return collect($documents)
			->filter()
			->map(function ($document) use ($company) {
				if ($document instanceof UploadedFile) {
					return $document->store(
						'company-verifications/' . $company->getKey(),
						'public'
					);
				}

				return (string) $document;
			})
			->values()
			->all();
	}
}

